import { useState } from "react";
import { Package } from "lucide-react";
/** Uses the catalog's existing image only, with a neutral fallback instead of a different product. */
export function InventoryProduct({
  name,
  image,
  children,
}: {
  name: string;
  image?: string | null;
  children: React.ReactNode;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className="inventory-product">
      <div className="inventory-product-photo">
        {image && failed !== image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            width={52}
            height={52}
            onError={() => setFailed(image)}
          />
        ) : (
          <Package aria-hidden="true" size={26} />
        )}
      </div>
      <div>
        <strong>{name}</strong>
        {children}
      </div>
    </div>
  );
}
