interface ShareGateProps {
  tokenType: "company" | "list" | "brain";
  tokenValue: string;
  children: React.ReactNode;
}

/**
 * ShareGate — email gate removed.
 * Share pages are now fully public: anyone with the link can view immediately.
 * This component is kept as a pass-through wrapper so no other files need changing.
 */
export function ShareGate({ children }: ShareGateProps) {
  return <>{children}</>;
}
