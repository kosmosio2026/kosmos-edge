export function Drawer({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] bg-white shadow-xl z-50 p-4">
      {children}
    </div>
  );
}