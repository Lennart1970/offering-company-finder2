import { SelectItem } from "@/components/ui/select";

export type CompanyDbSectorOption = { sector: string; count: number };

/** Renders SelectItem rows for getCompanyDbMeta.sectors ({ sector, count } objects). */
export function CompanyDbSectorSelectItems({
  sectors,
  showCount = true,
  className = "text-xs",
}: {
  sectors?: CompanyDbSectorOption[] | null;
  showCount?: boolean;
  className?: string;
}) {
  const list = sectors ?? [];
  return (
    <>
      {list.map(({ sector, count }) => (
        <SelectItem key={sector} value={sector} className={className}>
          {showCount ? (
            <>
              <span className="capitalize">{sector}</span>
              <span className="ml-1 text-gray-400">({count.toLocaleString()})</span>
            </>
          ) : (
            <span className="capitalize">{sector}</span>
          )}
        </SelectItem>
      ))}
    </>
  );
}
