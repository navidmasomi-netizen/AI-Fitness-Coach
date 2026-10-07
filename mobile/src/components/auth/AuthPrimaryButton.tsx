import { RunpuyButton } from '../../design-system/components/RunpuyButton';

type AuthPrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function AuthPrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: AuthPrimaryButtonProps) {
  return (
    <RunpuyButton
      label={label}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
    />
  );
}
