# ROJANATORN Workbook Mapping

Source workbook: `ROJANATORN GEMS STOCK 2026.xlsx`

## Sheets

- Inventory sheet: first workbook sheet (`รายละเอียดพลอย`)
- Usage sheets:
  - `Earrings`
  - `Neckelet` (mapped to category `necklace`)
  - `Bracelet`
  - `Brooch`
  - `Clips+Cuffinks`
  - `Ring`

## Inventory Mapping

Source columns (`A:K`) from inventory sheet map to `dbo.gem_inventory_items`:

- `NUMBER` -> `gemstone_number` (int), `gemstone_number_text` (raw text)
- `TYPE` -> `gemstone_type`
- `WEIGHT/PCS.` -> `weight_pcs_raw`
  - parsed `ct` -> `parsed_weight_ct`
  - parsed pieces -> `parsed_quantity_pcs`
- `SHAPE` -> `shape`
- `PRICE / CT.` -> `price_per_ct_raw`, parsed numeric -> `parsed_price_per_ct`
- `PRICE / PIECE` -> `price_per_piece_raw`, parsed numeric -> `parsed_price_per_piece`
- `BUYING DATE` -> `buying_date`, `buying_date_raw`
- `BALANCE/PCS.` -> `balance_pcs`
- `BALANCE/CT` -> `balance_ct`
- `USE DATE` -> `use_date`, `use_date_raw`
- `NAME` -> `owner_name`

## Usage Mapping

Usage sheets map to `dbo.gem_usage_batches` (header/product rows) and `dbo.gem_usage_lines` (gem usage rows):

- `วัน เดือน ปี` / first column -> `transaction_date`, `transaction_date_raw`
- `ชื่อคนเบิกพลอย` -> `requester_name` (batch and line level)
- `รหัสสินค้า` -> `product_code`
- `ราคารวม (บาท)` -> `total_amount` (batch)

Line-level fields:

- `รหัสพลอยทีใช้` -> `gemstone_number`
- `ชื่อพลอย` -> `gemstone_name`
- `ใช้ไป` (`จำนวนเม็ด`) -> `used_pcs`
- `น้ำหนัก/กะรัต` -> `used_weight_ct`
- `ราคา/เม็ด/กะรัต` -> `unit_price_raw`
- `ราคา (บาท)` -> `line_amount`
- `คงเหลือ` (`จำนวนเม็ด`) -> `balance_pcs_after`
- `จำนวนกะรัต` -> `balance_ct_after`

## Parse Notes

- Date parser supports mixed date/text cells and preserves raw source values.
- Numeric parser extracts first numeric token from mixed strings such as `1300.-/pc`, `650 / ct`, `300..-/pc`.
- Import script truncates target tables by default to ensure deterministic reload.
