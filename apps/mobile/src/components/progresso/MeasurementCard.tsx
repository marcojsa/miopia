// Card de UMA consulta na aba Progresso.
// Estrutura: data por extenso + tabela de valores absolutos POR OLHO (linhas
// OD/OE; colunas Grau esférico, Cilíndrico, Equiv. esférico, Comprimento axial)
// + bloco "Avaliação da Dra. Christiane" (doctor_note + status + data).
//
// ANVISA RDC 657/2022 + decisão jurídica 12/06/2026: o app SÓ EXIBE valores
// absolutos. ZERO variação/delta entre consultas, ZERO seta, ZERO média, ZERO
// gráfico, ZERO cor semafórica. Valores clínicos em TINTA NEUTRA (ink/ink2/ink3).
// A única interpretação é o texto da médica, SEMPRE em roxo neutro fixo (a cor
// NÃO muda com o status). status 'sem_avaliacao' omite o bloco da Dra.
import { StyleSheet, View } from 'react-native';

import { StethoscopeIcon } from './StethoscopeIcon';
import {
  NOT_RECORDED,
  clinicalStatusLabel,
  formatAxial,
  formatDiopters,
  longDateWithYearPtBR,
} from './progressoHelpers';
import { AppText } from '@/components/ui';
import { colors, fonts, radii, spacing } from '@/theme/tokens';
import type { Measurement } from '@/types/domain';

export interface MeasurementCardProps {
  measurement: Measurement;
}

interface EyeRow {
  label: string;
  sphere: string;
  cylinder: string;
  se: string;
  axial: string;
}

function buildEyeRow(
  label: string,
  sphere: number | null,
  cylinder: number | null,
  se: number | null,
  axial: number | null
): EyeRow {
  return {
    label,
    sphere: formatDiopters(sphere) ?? NOT_RECORDED,
    cylinder: formatDiopters(cylinder) ?? NOT_RECORDED,
    se: formatDiopters(se) ?? NOT_RECORDED,
    axial: formatAxial(axial) ?? NOT_RECORDED,
  };
}

const COLUMNS = ['Grau esférico', 'Cilíndrico', 'Equiv. esférico', 'Comprimento axial'] as const;

export function MeasurementCard({ measurement: m }: MeasurementCardProps) {
  const consultaData = longDateWithYearPtBR(m.measured_on);
  const statusLabel = clinicalStatusLabel(m.status);
  const hasNote = m.doctor_note !== null && m.doctor_note.trim().length > 0;
  const showDoctorBlock = m.status !== 'sem_avaliacao' && (hasNote || statusLabel !== null);

  const rows: EyeRow[] = [
    buildEyeRow('Olho direito (OD)', m.od_sphere, m.od_cylinder, m.od_se, m.od_axial_mm),
    buildEyeRow('Olho esquerdo (OE)', m.oe_sphere, m.oe_cylinder, m.oe_se, m.oe_axial_mm),
  ];

  return (
    <View style={styles.card}>
      <AppText variant="cardTitle">{`Consulta de ${consultaData}`}</AppText>

      {/* Tabela de valores absolutos — TINTA NEUTRA, sem cor de juízo. */}
      <View style={styles.table} accessibilityLabel={`Medidas da consulta de ${consultaData}`}>
        {rows.map((row) => (
          <View key={row.label} style={styles.eyeBlock}>
            <AppText variant="meta" color={colors.ink2} style={styles.eyeLabel}>
              {row.label}
            </AppText>
            {COLUMNS.map((col, i) => {
              const value = [row.sphere, row.cylinder, row.se, row.axial][i];
              return (
                <View key={col} style={styles.dataRow}>
                  <AppText variant="meta" color={colors.ink3} style={styles.dataKey}>
                    {col}
                  </AppText>
                  <AppText variant="meta" color={colors.ink} style={styles.dataValue}>
                    {value}
                  </AppText>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Avaliação da Dra. — ÚNICA interpretação, sempre roxo neutro fixo. */}
      {showDoctorBlock ? (
        <View style={styles.draBlock}>
          <View style={styles.draTop}>
            <View style={styles.draBadge}>
              <StethoscopeIcon size={20} color={colors.purple} />
            </View>
            <View style={styles.draHead}>
              <AppText variant="meta" color={colors.purple900} style={styles.draTitle}>
                Avaliação da Dra. Christiane
              </AppText>
              <AppText variant="small" color={colors.ink3}>
                {`Consulta de ${consultaData}`}
              </AppText>
            </View>
          </View>

          {hasNote ? (
            <AppText variant="body" color={colors.ink} style={styles.draText}>
              {m.doctor_note?.trim()}
            </AppText>
          ) : null}

          {statusLabel ? (
            <AppText variant="meta" color={colors.purple} style={styles.draStatus}>
              {statusLabel}
            </AppText>
          ) : null}

          <View style={styles.draSign}>
            <AppText variant="small" color={colors.purple900} style={styles.draSignName}>
              Dra. Christiane Sciammarella Wakisaka
            </AppText>
            <AppText variant="small" color={colors.ink2}>
              CRM 75.580 | RQE 41.563 · Oftalmologia Alto de Pinheiros
            </AppText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.purple100,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    shadowColor: colors.purple900,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  table: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  eyeBlock: {
    marginBottom: spacing.md,
  },
  eyeLabel: {
    fontFamily: fonts.interBold,
    marginBottom: spacing.xs,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dataKey: {
    flex: 1,
  },
  dataValue: {
    fontFamily: fonts.interBold,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  draBlock: {
    marginTop: spacing.md,
    backgroundColor: colors.purple50,
    borderRadius: radii.cardSm,
    borderWidth: 1,
    borderColor: colors.purple100,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  draTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  draBadge: {
    width: 38,
    height: 38,
    borderRadius: radii.iconBox,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  draHead: {
    flex: 1,
  },
  draTitle: {
    fontFamily: fonts.nunitoExtraBold,
  },
  draText: {
    marginTop: spacing.md,
    lineHeight: 20,
  },
  draStatus: {
    marginTop: spacing.md,
    fontFamily: fonts.interBold,
  },
  draSign: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.purple100,
    paddingTop: spacing.sm,
  },
  draSignName: {
    fontFamily: fonts.nunitoExtraBold,
    marginBottom: 1,
  },
});
