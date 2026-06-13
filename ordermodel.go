package main

type Order struct {
	OrderNumber   string `yaml:"order_number" json:"order_number"`
	Ordering      bool   `yaml:"ordering" json:"ordering"`
	OrderingDate  string `yaml:"ordering_date" json:"ordering_date"`
	ShippingDate  string `yaml:"shipping_date" json:"shipping_date"`
	Documents     bool   `yaml:"documents" json:"documents"`
	DocumentsDate string `yaml:"documents_date" json:"documents_date"`
	TelexRelease  bool   `yaml:"telex_release" json:"telex_release"`
	TelexRelDate  string `yaml:"telex_rel_date" json:"telex_rel_date"`
	Remarks       string `yaml:"remarks" json:"remarks"`
	Completed     bool   `yaml:"completed" json:"completed"`
}

type OrdersFile struct {
	Orders []Order `yaml:"orders" json:"orders"`
}
