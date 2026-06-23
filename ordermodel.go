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
	Completed     bool         `yaml:"completed" json:"completed"`
	Pinned        bool         `yaml:"pinned" json:"pinned"`
	Details       []DetailRow  `yaml:"details" json:"details"`
}

type DetailRow struct {
	Date              string `yaml:"date" json:"date"`
	ExchangeRate      string `yaml:"exchange_rate" json:"exchange_rate"`
	ExecRate          string `yaml:"exec_rate" json:"exec_rate"`
	Country           string `yaml:"country" json:"country"`
	Customer          string `yaml:"customer" json:"customer"`
	Product           string `yaml:"product" json:"product"`
	RebateRate        string `yaml:"rebate_rate" json:"rebate_rate"`
	Factory           string `yaml:"factory" json:"factory"`
	FactoryPrice      string `yaml:"factory_price" json:"factory_price"`
	Packaging         string `yaml:"packaging" json:"packaging"`
	ContainerType     string `yaml:"container_type" json:"container_type"`
	Quantity          string `yaml:"quantity" json:"quantity"`
	PortOfLoading     string `yaml:"port_of_loading" json:"port_of_loading"`
	PortOfDestination string `yaml:"port_of_destination" json:"port_of_destination"`
	MiscFeeRMB        string `yaml:"misc_fee_rmb" json:"misc_fee_rmb"`
	FreightUSD        string `yaml:"freight_usd" json:"freight_usd"`
	ProfitRate        string `yaml:"profit_rate" json:"profit_rate"`
	FOBPrice          string `yaml:"fob_price" json:"fob_price"`
	CFRPrice          string `yaml:"cfr_price" json:"cfr_price"`
	CIFPrice          string `yaml:"cif_price" json:"cif_price"`
	Profit            string `yaml:"profit" json:"profit"`
	Copied            bool   `yaml:"copied" json:"copied"`
}

type OrdersFile struct {
	Orders []Order `yaml:"orders" json:"orders"`
}
