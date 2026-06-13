export interface Order {
  order_number: string;
  ordering: boolean;
  ordering_date: string;
  shipping_date: string;
  documents: boolean;
  documents_date: string;
  telex_release: boolean;
  telex_rel_date: string;
  remarks: string;
}
