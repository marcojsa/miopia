// Entrar: e-mail + senha (conta criada pela clínica, por convite — signup
// desabilitado). Header roxo compacto (gradiente da Hoje) sobre fundo claro.
// Erros do Supabase viram mensagens amigáveis em pt-BR; "Esqueci minha senha"
// usa supabase.auth.resetPasswordForEmail com feedback inline.
// Após o login o redirect é automático: o guard do (auth)/_layout observa a
// sessão e leva ao app — esta tela não navega por conta própria.
import type { AuthError } from '@supabase/supabase-js';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthTextField } from '@/components/auth/AuthTextField';
import { ChevronIcon } from '@/components/icons';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, fonts, gradients, radii, spacing } from '@/theme/tokens';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

interface FieldErrors {
  email?: string;
  password?: string;
}

interface Status {
  kind: 'error' | 'info';
  text: string;
}

const MSG_OFFLINE = 'Não conseguimos conectar. Verifique sua internet e tente novamente.';

function isRateLimit(error: AuthError): boolean {
  const msg = error.message.toLowerCase();
  return error.status === 429 || msg.includes('rate limit') || msg.includes('too many');
}

// Traduz o erro do Supabase para uma mensagem amigável (nunca stack trace).
function friendlySignInError(error: AuthError): string {
  const msg = error.message.toLowerCase();
  if (msg.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Confira os dados e tente de novo.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Este e-mail ainda não foi confirmado. Fale com a clínica para reativar seu convite.';
  }
  if (isRateLimit(error)) {
    return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return MSG_OFFLINE;
  }
  return 'Não foi possível entrar agora. Tente novamente em instantes.';
}

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (!EMAIL_RE.test(email.trim())) errors.email = 'Digite um e-mail válido.';
    if (password.length === 0) errors.password = 'Digite sua senha.';
    setFieldErrors(errors);
    return !errors.email && !errors.password;
  };

  const handleSignIn = async (): Promise<void> => {
    if (submitting) return;
    setStatus(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        setStatus({ kind: 'error', text: friendlySignInError(error) });
      }
      // Sucesso: o guard do layout redireciona sozinho.
    } catch {
      setStatus({ kind: 'error', text: MSG_OFFLINE });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (): Promise<void> => {
    if (sendingReset || submitting) return;
    setStatus(null);
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setFieldErrors((prev) => ({
        ...prev,
        email: 'Preencha seu e-mail acima para receber o link.',
      }));
      return;
    }
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed);
      if (error) {
        setStatus({
          kind: 'error',
          text: isRateLimit(error)
            ? 'Você pediu um link há pouco. Aguarde alguns minutos antes de pedir outro.'
            : 'Não foi possível enviar o link agora. Tente novamente em instantes.',
        });
      } else {
        setStatus({
          kind: 'info',
          text: 'Enviamos um link para seu e-mail. Confira a caixa de entrada e a pasta de spam.',
        });
      }
    } catch {
      setStatus({ kind: 'error', text: MSG_OFFLINE });
    } finally {
      setSendingReset(false);
    }
  };

  const handleBack = (): void => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/welcome');
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <LinearGradient
        colors={[...gradients.headerHoje.colors]}
        start={gradients.headerHoje.start}
        end={gradients.headerHoje.end}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={10}
          style={({ pressed }) => [styles.back, pressed ? styles.pressedDim : null]}
        >
          <ChevronIcon direction="left" color={colors.white} size={19} />
        </Pressable>
        <AppText variant="title" color={colors.white} accessibilityRole="header" style={styles.headerTitle}>
          Entrar
        </AppText>
        <AppText variant="body" color={colors.purple100}>
          Use o e-mail em que você recebeu o convite da clínica.
        </AppText>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
        >
          {status ? (
            <View
              style={[styles.banner, status.kind === 'info' ? styles.bannerInfo : styles.bannerError]}
              accessibilityLiveRegion="polite"
            >
              <AppText
                variant="meta"
                color={status.kind === 'info' ? colors.purple800 : colors.ink}
              >
                {status.text}
              </AppText>
            </View>
          ) : null}

          <Card>
            <AuthTextField
              label="E-mail"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              error={fieldErrors.email}
              placeholder="seuemail@exemplo.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="E-mail"
            />
            <AuthTextField
              ref={passwordRef}
              label="Senha"
              secret
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              error={fieldErrors.password}
              placeholder="Sua senha"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => {
                void handleSignIn();
              }}
              accessibilityLabel="Senha"
              containerStyle={styles.passwordField}
            />
            <Button
              label="Entrar"
              onPress={() => {
                void handleSignIn();
              }}
              loading={submitting}
              style={styles.submit}
            />
            <Pressable
              onPress={() => {
                void handleForgotPassword();
              }}
              disabled={sendingReset}
              accessibilityRole="button"
              accessibilityLabel="Esqueci minha senha"
              style={({ pressed }) => [styles.forgot, pressed ? styles.pressedDim : null]}
            >
              <AppText variant="meta" color={colors.purple} style={styles.forgotText}>
                {sendingReset ? 'Enviando link...' : 'Esqueci minha senha'}
              </AppText>
            </Pressable>
          </Card>

          <AppText variant="small" style={styles.footNote}>
            O acesso é criado pela clínica, por convite. Ainda não tem o seu? Fale com a recepção.
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.headerX,
    paddingBottom: 18,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    marginBottom: 4,
  },
  scroll: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
  },
  banner: {
    borderRadius: radii.cardSm,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
  },
  bannerInfo: {
    backgroundColor: colors.purple50,
    borderColor: colors.purple200,
  },
  bannerError: {
    backgroundColor: colors.white,
    borderColor: colors.coral,
  },
  passwordField: {
    marginTop: spacing.md,
  },
  submit: {
    marginTop: spacing.xl,
  },
  forgot: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  forgotText: {
    fontFamily: fonts.interBold,
  },
  footNote: {
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  pressedDim: {
    opacity: 0.6,
  },
});
