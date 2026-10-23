import type { CatalogCard } from "../catalog-types";
import { CARDS as AMEX_HSBC_SC_OTHERS } from "./amex-hsbc-sc-others";
import { CARDS as HDFC_ICICI } from "./hdfc-icici";
import { CARDS as IDFC_AU_INDUSIND_YES_RBL_BOB } from "./idfc-au-indusind-yes-rbl-bob";
import { CARDS as SBI_AXIS_KOTAK } from "./sbi-axis-kotak";

export const EXTRA_CARDS: CatalogCard[] = [
  ...HDFC_ICICI,
  ...SBI_AXIS_KOTAK,
  ...IDFC_AU_INDUSIND_YES_RBL_BOB,
  ...AMEX_HSBC_SC_OTHERS,
];
