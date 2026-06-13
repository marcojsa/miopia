// Campo de texto dos formulários de entrada (e-mail/senha).
// Visual do design system: fundo branco, borda #E2E8F0 (foco roxo, erro coral),
// raio 14 (radii.button), corpo Inter. Senha tem alternância Mostrar/Ocultar em
// texto (a fundação não tem ícone de olho — e texto é mais claro para os pais).
import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui';
import { colors, fonts, radii } from '@/theme/tokens';

export interface AuthTextFieldProps extends Omit<TextInputProps, 'style' | 'secureTextEntry'> {
  label: string;
  /** Mensagem de erro do campo; também pinta a borda de coral. */
  error?: string | null;
  /** Campo de senha: oculta o texto e mostra a alternância Mostrar/Ocultar. */
  secret?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export const AuthTextField = forwardRef<TextInput, AuthTextFieldProps>(function AuthTextField(
  { label, error, secret = false, containerStyle, onFocus, onBlur, ...inputProps },
  ref
) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.coral : focused ? colors.purple : colors.line;

  return (
    <View style={containerStyle}>
      <AppText variant="meta" color={colors.ink2} style={styles.label}>
        {label}
      </AppText>
      <View style={[styles.inputRow, { borderColor }]}>
        <TextInput
          ref={ref}
          {...inputProps}
          secureTextEntry={secret && hidden}
          style={styles.input}
          placeholderTextColor={colors.ink3}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        {secret ? (
          <Pressable
            onPress={() => setHidden((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}
            hitSlop={10}
            style={({ pressed }) => [styles.toggle, pressed ? styles.togglePressed : null]}
          >
            <AppText variant="small" color={colors.purple} style={styles.toggleText}>
              {hidden ? 'Mostrar' : 'Ocultar'}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="small" color={colors.coral} style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderRadius: radii.button,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  input: {
    flex: 1,
    fontFamily: fonts.interMedium,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 12,
  },
  toggle: {
    paddingLeft: 10,
    paddingVertical: 6,
  },
  togglePressed: {
    opacity: 0.6,
  },
  toggleText: {
    fontFamily: fonts.interBold,
    fontSize: 11.5,
  },
  error: {
    marginTop: 5,
    fontFamily: fonts.interSemiBold,
  },
});
