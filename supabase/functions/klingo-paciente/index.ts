// ============================================================
// Edge Function: klingo-paciente
//
// Por que existe: a secretária cadastra no Lumi crianças que já estão no
// Klingo (sistema de agenda/prontuário da clínica). Em vez de redigitar, o
// painel busca a marcação ou a ficha no Klingo e preenche o formulário.
// O token do Klingo (X-APP-TOKEN) só existe aqui, como segredo da função.
//
// LGPD (regra dura do projeto): o Lumi NÃO guarda CPF, endereço nem celular.
// O CPF é lido do Klingo e usado só do lado do servidor; a resposta nunca o
// devolve, e nenhum log o registra. Atenção: o Klingo ecoa o CPF na mensagem
// de erro de "paciente não identificado", então o corpo de erro do Klingo
// nunca é repassado nem logado; só o status e o código.
//
// Identificador estável do paciente (paciente_ref), conferido em 15/10/2026
// comparando a agenda (/telefonia/lista) com a ficha (/paciente/cpf):
//   - paciente com cadastro definitivo: agenda.id_paciente é numérico e é
//     igual a ficha.chave (ficha.id é outro código, "P…", que não bate);
//   - pré-cadastro (marcado sem cadastro completo): agenda.id_paciente vem
//     como "TMP:<n>", a ficha não tem chave e ficha.id = <n> (= agenda.id_api).
//   paciente_ref = "<chave>" no primeiro caso e "TMP:<n>" no segundo
//   (provisorio = true: pode mudar quando a recepção completar o cadastro).
//
// Ações (POST JSON, só equipe):
//   {acao:'agenda', data:'AAAA-MM-DD'}  → marcações do dia, sem CPF/celular
//   {acao:'ficha', data, ref}           → ficha do paciente da marcação ref
//   {acao:'cpf', cpf}                   → ficha pelo CPF digitado
//
// Respostas: 200 ok · 400 pedido inválido · 401 sem sessão · 403 não é equipe
// · 404 marcação/paciente não encontrado · 405 método · 422 marcação sem CPF
// · 429 limite do Klingo · 500 configuração · 502/504 Klingo fora ou recusou.
// Erros sempre como { erro: <código>, mensagem: <texto pt-BR> }.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const KLINGO_BASE = "https://api-externa.klingo.app/api";
const CACHE_TTL_MS = 10 * 60 * 1000; // agenda e fichas: 10 min em memória
const INTERVALO_MIN_MS = 1200; // o Klingo devolve 429 se consultar demais
const TIMEOUT_MS = 15_000;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PedidoBody {
  acao?: string;
  data?: string;
  ref?: string | number;
  cpf?: string;
}

// Campos do Klingo que esta função lê (o resto da resposta é ignorado).
interface MarcacaoKlingo {
  id_marcacao?: number | string | null;
  id_paciente?: number | string | null;
  nome?: string | null;
  nascimento?: string | null; // "AAAA-MM-DD" ou "AAAA-MM-DD HH:MM:SS"
  cpf?: string | null;
  hora?: string | null;
  datahora?: string | null;
  medico?: string | null;
}

interface FichaKlingo {
  id?: number | string | null;
  chave?: number | string | null;
  nome?: string | null;
  nome_social?: string | null;
  dt_nasc?: string | null;
  mae?: string | null;
  contatos?: { email?: string | null } | null;
}

interface SaidaMarcacao {
  ref: string;
  paciente_ref: string | null;
  provisorio: boolean;
  nome: string;
  primeiro_nome: string;
  nascimento: string | null;
  idade: number | null;
  crianca: boolean;
  hora: string;
  medico: string;
  tem_cpf: boolean;
}

interface SaidaFicha {
  paciente_ref: string;
  provisorio: boolean;
  nome: string;
  primeiro_nome: string;
  nascimento: string | null;
  idade: number | null;
  crianca: boolean;
  responsavel_nome: string | null;
  responsavel_email: string | null;
}

class FalhaKlingo extends Error {
  constructor(readonly status: number, readonly codigo: string, mensagem: string) {
    super(mensagem);
  }
}

function falha(status: number, erro: string, mensagem: string): Response {
  return jsonResponse(status, { erro, mensagem });
}

// ---------- Formatação ----------

// "MARIA DA SILVA" → "Maria da Silva". Só mexe em nomes todo em maiúsculas
// ou todo em minúsculas, para não estragar grafias como "McDonald".
const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du", "del"]);
function nomeProprio(bruto: string | null | undefined): string {
  const s = (bruto ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  const temMaiuscula = /\p{Lu}/u.test(s);
  const temMinuscula = /\p{Ll}/u.test(s);
  if (temMaiuscula && temMinuscula) return s;
  return s
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_m, sep: string, letra: string) => sep + letra.toLocaleUpperCase("pt-BR"))
    .split(" ")
    .map((p, i) => (i > 0 && PARTICULAS.has(p.toLocaleLowerCase("pt-BR")) ? p.toLocaleLowerCase("pt-BR") : p))
    .join(" ");
}

function primeiraPalavra(s: string): string {
  return s.split(" ")[0] ?? "";
}

function nascimentoISO(bruto: string | null | undefined): string | null {
  const d = String(bruto ?? "").slice(0, 10);
  return DATA_RE.test(d) && !d.startsWith("0000") ? d : null;
}

// Hoje no fuso da clínica (a função roda em UTC).
function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function idadeEmAnos(nascimento: string | null): number | null {
  if (!nascimento) return null;
  const [ny, nm, nd] = nascimento.split("-").map(Number);
  const [hy, hm, hd] = hojeSP().split("-").map(Number);
  let idade = hy - ny;
  if (hm < nm || (hm === nm && hd < nd)) idade--;
  return idade >= 0 ? idade : null;
}

function soDigitos(bruto: unknown): string {
  return String(bruto ?? "").replace(/\D/g, "");
}

// CPF: 11 dígitos e dígitos verificadores corretos (evita gastar consulta do
// Klingo com número digitado errado).
function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(cpf.slice(0, 9), 10) === Number(cpf[9]) && dv(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function dataValida(data: string): boolean {
  if (!DATA_RE.test(data)) return false;
  const d = new Date(`${data}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data;
}

// ---------- Identificador estável (ver cabeçalho) ----------

function refDaAgenda(m: MarcacaoKlingo): { ref: string | null; provisorio: boolean } {
  const bruto = m.id_paciente;
  if (typeof bruto === "number") return { ref: String(bruto), provisorio: false };
  const s = String(bruto ?? "").trim();
  if (/^\d+$/.test(s)) return { ref: s, provisorio: false };
  const tmp = /^TMP:(\d+)$/i.exec(s);
  if (tmp) return { ref: `TMP:${tmp[1]}`, provisorio: true };
  return { ref: s || null, provisorio: false };
}

function refDaFicha(f: FichaKlingo): { ref: string; provisorio: boolean } | null {
  const chave = String(f.chave ?? "").trim();
  if (chave) return { ref: chave, provisorio: false };
  const id = String(f.id ?? "").trim();
  if (/^\d+$/.test(id)) return { ref: `TMP:${id}`, provisorio: true };
  return null;
}

// ---------- Cliente do Klingo (fila espaçada + cache) ----------

// Fila por instância: uma consulta por vez, com intervalo mínimo entre elas.
let fila: Promise<unknown> = Promise.resolve();
let ultimaConsulta = 0;

function naFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const vez = fila.then(async () => {
    const espera = ultimaConsulta + INTERVALO_MIN_MS - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    try {
      return await tarefa();
    } finally {
      ultimaConsulta = Date.now();
    }
  });
  fila = vez.catch(() => undefined);
  return vez;
}

async function klingoGet(token: string, rota: string): Promise<unknown> {
  // Só o caminho entra em log; a query (que leva o CPF) nunca.
  const rotaLog = rota.split("?")[0];
  return naFila(async () => {
    let resp: Response;
    try {
      resp = await fetch(KLINGO_BASE + rota, {
        headers: { "X-APP-TOKEN": token, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      // A mensagem do erro de rede do Deno traz a URL (com o CPF): não logar.
      const timeout = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
      console.error(`klingo ${rotaLog}: ${timeout ? "timeout" : "falha de rede"}`);
      throw timeout
        ? new FalhaKlingo(504, "klingo_indisponivel", "O Klingo demorou demais para responder. Tente de novo em instantes.")
        : new FalhaKlingo(502, "klingo_indisponivel", "Não foi possível falar com o Klingo agora. Tente de novo em instantes.");
    }

    const texto = await resp.text();
    let corpo: unknown = null;
    try {
      corpo = JSON.parse(texto);
    } catch {
      // 401 do Klingo vem em text/html.
    }
    if (resp.ok) return corpo;

    const codigo =
      corpo && typeof corpo === "object" && "code" in corpo
        ? String((corpo as { code: unknown }).code)
        : "";
    console.error(`klingo ${rotaLog}: HTTP ${resp.status}${codigo ? ` ${codigo}` : ""}`);

    if (codigo === "PACIENTE_NAO_IDENTIFICADO") {
      throw new FalhaKlingo(404, "paciente_nao_encontrado", "Nenhum paciente com este CPF no Klingo.");
    }
    if (resp.status === 429) {
      throw new FalhaKlingo(
        429,
        "klingo_limite",
        "O Klingo recebeu consultas demais em pouco tempo. Espere um minuto e tente de novo.",
      );
    }
    if (resp.status === 401 || resp.status === 403) {
      throw new FalhaKlingo(
        502,
        "klingo_token",
        "O Klingo recusou a chave de acesso do Lumi. Avise o suporte para renovar a chave.",
      );
    }
    if (resp.status >= 500) {
      throw new FalhaKlingo(502, "klingo_indisponivel", "O Klingo está com problema agora. Tente de novo em alguns minutos.");
    }
    throw new FalhaKlingo(502, "klingo_erro", `O Klingo devolveu um erro inesperado (HTTP ${resp.status}). Tente de novo.`);
  });
}

// Cache em memória da instância (some quando a função é reciclada).
// A agenda guarda as marcações cruas (com CPF) só aqui, para a ação 'ficha'
// pegar o CPF do lado do servidor; nunca sai da função.
const cacheAgenda = new Map<string, { em: number; itens: MarcacaoKlingo[] }>();
// Fichas já higienizadas (sem CPF), por hash do CPF.
const cacheFicha = new Map<string, { em: number; ficha: SaidaFicha }>();

function limparVencidos() {
  const agora = Date.now();
  for (const [k, v] of cacheAgenda) if (agora - v.em >= CACHE_TTL_MS) cacheAgenda.delete(k);
  for (const [k, v] of cacheFicha) if (agora - v.em >= CACHE_TTL_MS) cacheFicha.delete(k);
}

async function agendaDoDia(
  token: string,
  data: string,
  { ignorarCache = false } = {},
): Promise<{ itens: MarcacaoKlingo[]; doCache: boolean }> {
  limparVencidos();
  const salvo = cacheAgenda.get(data);
  if (salvo && !ignorarCache) return { itens: salvo.itens, doCache: true };
  const corpo = await klingoGet(token, `/telefonia/lista/${data}`);
  const itens = Array.isArray(corpo) ? (corpo as MarcacaoKlingo[]) : [];
  cacheAgenda.set(data, { em: Date.now(), itens });
  return { itens, doCache: false };
}

async function hashCpf(cpf: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`lumi:${cpf}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function fichaPorCpf(token: string, cpf: string): Promise<SaidaFicha> {
  limparVencidos();
  const chave = await hashCpf(cpf);
  const salva = cacheFicha.get(chave);
  if (salva) return salva.ficha;

  const corpo = await klingoGet(token, `/paciente/cpf?cpf=${cpf}`);
  const bruta = (Array.isArray(corpo) ? corpo[0] : corpo) as FichaKlingo | null | undefined;
  if (!bruta || typeof bruta !== "object" || !String(bruta.nome ?? "").trim()) {
    throw new FalhaKlingo(404, "paciente_nao_encontrado", "Nenhum paciente com este CPF no Klingo.");
  }
  const id = refDaFicha(bruta);
  if (!id) {
    console.error("klingo /paciente/cpf: ficha sem chave nem id numérico");
    throw new FalhaKlingo(
      502,
      "klingo_formato",
      "O Klingo devolveu uma ficha num formato que o Lumi não reconhece. Complete os dados à mão.",
    );
  }

  const nome = nomeProprio(bruta.nome);
  const social = nomeProprio(bruta.nome_social);
  const nascimento = nascimentoISO(bruta.dt_nasc);
  const idade = idadeEmAnos(nascimento);
  const email = String(bruta.contatos?.email ?? "").trim().toLowerCase();
  const ficha: SaidaFicha = {
    paciente_ref: id.ref,
    provisorio: id.provisorio,
    nome,
    primeiro_nome: primeiraPalavra(social || nome),
    nascimento,
    idade,
    crianca: idade !== null && idade < 18,
    responsavel_nome: nomeProprio(bruta.mae) || null,
    responsavel_email: EMAIL_RE.test(email) ? email : null,
  };
  cacheFicha.set(chave, { em: Date.now(), ficha });
  return ficha;
}

function marcacaoParaSaida(m: MarcacaoKlingo): SaidaMarcacao {
  const nome = nomeProprio(m.nome);
  const nascimento = nascimentoISO(m.nascimento);
  const idade = idadeEmAnos(nascimento);
  const { ref, provisorio } = refDaAgenda(m);
  const hora = String(m.hora ?? "").trim() || String(m.datahora ?? "").slice(11, 16);
  return {
    ref: String(m.id_marcacao ?? ""),
    paciente_ref: ref,
    provisorio,
    nome,
    primeiro_nome: primeiraPalavra(nome),
    nascimento,
    idade,
    crianca: idade !== null && idade < 18,
    hora,
    medico: nomeProprio(m.medico),
    tem_cpf: soDigitos(m.cpf).length === 11,
  };
}

// ---------- Handler ----------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return falha(405, "metodo_nao_permitido", "Use POST.");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return falha(500, "configuracao", "A função está sem as variáveis do Supabase.");
  }

  // --- 1. Quem chama? Só equipe ativa (mesmo padrão do invite-family) ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return falha(401, "sem_sessao", "Sua sessão expirou. Entre novamente.");
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return falha(401, "sem_sessao", "Sua sessão expirou. Entre novamente.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: staffRow, error: staffError } = await admin
    .from("staff")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .eq("active", true)
    .maybeSingle();
  if (staffError) {
    return falha(500, "equipe_indisponivel", "Não foi possível conferir o seu perfil. Tente de novo.");
  }
  if (!staffRow) {
    return falha(403, "nao_e_equipe", "Só a equipe da clínica pode consultar o Klingo.");
  }

  // --- 2. Configuração do Klingo ---
  const token = Deno.env.get("KLINGO_APP_TOKEN")?.trim();
  if (!token) {
    return falha(
      500,
      "klingo_sem_token",
      "A busca no Klingo não está configurada: falta o segredo KLINGO_APP_TOKEN no Supabase.",
    );
  }

  // --- 3. Pedido ---
  let body: PedidoBody;
  try {
    body = (await req.json()) as PedidoBody;
  } catch {
    return falha(400, "pedido_invalido", "Pedido inválido.");
  }

  try {
    if (body.acao === "agenda") {
      const data = String(body.data ?? "");
      if (!dataValida(data)) return falha(400, "data_invalida", "Informe o dia no formato AAAA-MM-DD.");
      const { itens } = await agendaDoDia(token, data);
      const marcacoes = itens
        .map(marcacaoParaSaida)
        .sort((a, b) => a.hora.localeCompare(b.hora) || a.nome.localeCompare(b.nome, "pt-BR"));
      return jsonResponse(200, { data, marcacoes });
    }

    if (body.acao === "ficha") {
      const data = String(body.data ?? "");
      const ref = String(body.ref ?? "").trim();
      if (!dataValida(data)) return falha(400, "data_invalida", "Informe o dia no formato AAAA-MM-DD.");
      if (!ref) return falha(400, "ref_invalida", "Informe a marcação.");

      let { itens, doCache } = await agendaDoDia(token, data);
      let marcacao = itens.find((m) => String(m.id_marcacao) === ref);
      if (!marcacao && doCache) {
        ({ itens, doCache } = await agendaDoDia(token, data, { ignorarCache: true }));
        marcacao = itens.find((m) => String(m.id_marcacao) === ref);
      }
      if (!marcacao) {
        return falha(404, "marcacao_nao_encontrada", "Esta marcação não está mais na agenda do Klingo. Atualize a lista.");
      }
      const cpf = soDigitos(marcacao.cpf);
      if (cpf.length !== 11) {
        return falha(422, "sem_cpf", "Esta marcação não tem CPF no Klingo: complete os dados à mão.");
      }
      const ficha = await fichaPorCpf(token, cpf);
      // A ficha é a fonte do identificador; a agenda cobre o nascimento se faltar.
      const nascimento = ficha.nascimento ?? nascimentoISO(marcacao.nascimento);
      const idade = idadeEmAnos(nascimento);
      return jsonResponse(200, { ...ficha, nascimento, idade, crianca: idade !== null && idade < 18 });
    }

    if (body.acao === "cpf") {
      const cpf = soDigitos(body.cpf);
      if (cpf.length !== 11) return falha(400, "cpf_invalido", "O CPF precisa ter 11 números.");
      if (!cpfValido(cpf)) return falha(400, "cpf_invalido", "CPF inválido: confira os números.");
      return jsonResponse(200, await fichaPorCpf(token, cpf));
    }

    return falha(400, "acao_invalida", "Ação desconhecida. Use 'agenda', 'ficha' ou 'cpf'.");
  } catch (e) {
    if (e instanceof FalhaKlingo) return falha(e.status, e.codigo, e.message);
    // Sem e.message: pode carregar dado do pedido.
    console.error(`klingo-paciente: erro inesperado (${e instanceof Error ? e.name : typeof e})`);
    return falha(500, "erro_interno", "Erro inesperado ao consultar o Klingo. Tente de novo.");
  }
});
