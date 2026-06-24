package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"
)

type OrderService struct {
	configPath string
}

type appConfig struct {
	Path              string `json:"path"`
	SortDir           string `json:"sort_dir"`
	ColumnWidths      string `json:"column_widths"`
	DetailColWidths   string `json:"detail_col_widths"`
}

func (s *OrderService) loadConfig() *appConfig {
	cfgFile := s.configFilePath()
	if cfgFile == "" {
		return &appConfig{}
	}
	data, err := os.ReadFile(cfgFile)
	if err != nil {
		return &appConfig{}
	}
	var cfg appConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return &appConfig{}
	}
	return &cfg
}

func (s *OrderService) saveConfig(cfg *appConfig) {
	cfgFile := s.configFilePath()
	if cfgFile == "" {
		return
	}
	cfgDir := filepath.Dir(cfgFile)
	os.MkdirAll(cfgDir, 0755)
	data, _ := json.MarshalIndent(cfg, "", "  ")
	os.WriteFile(cfgFile, data, 0644)
}

func (s *OrderService) configFilePath() string {
	cfgDir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(cfgDir, "OrdersTrack", "config.json")
}

func (s *OrderService) GetConfigPath() string {
	cfg := s.loadConfig()
	if cfg.Path != "" {
		s.configPath = cfg.Path
	}
	return cfg.Path
}

func (s *OrderService) SetConfigPath(path string) bool {
	s.configPath = path

	cfg := s.loadConfig()
	cfg.Path = path
	s.saveConfig(cfg)

	ordersFile := filepath.Join(path, "orders.yaml")
	if _, err := os.Stat(ordersFile); os.IsNotExist(err) {
		s.writeOrdersFile(ordersFile, &OrdersFile{Orders: []Order{}})
	}

	return true
}

func (s *OrderService) GetSortDir() string {
	cfg := s.loadConfig()
	if cfg.SortDir == "" {
		return "asc"
	}
	return cfg.SortDir
}

func (s *OrderService) SaveSortDir(dir string) {
	cfg := s.loadConfig()
	cfg.SortDir = dir
	s.saveConfig(cfg)
}

func (s *OrderService) GetColumnWidths() string {
	cfg := s.loadConfig()
	return cfg.ColumnWidths
}

func (s *OrderService) SaveColumnWidths(widths string) {
	cfg := s.loadConfig()
	cfg.ColumnWidths = widths
	s.saveConfig(cfg)
}

func (s *OrderService) LoadOrders() []Order {
	if s.configPath == "" {
		s.GetConfigPath()
	}
	return s.readOrdersFromFile()
}

func (s *OrderService) AddOrder(orderNumber string) *Order {
	orders := s.readOrdersFromFile()
	for _, o := range orders {
		if o.OrderNumber == orderNumber {
			return nil
		}
	}
	order := Order{
		OrderNumber: orderNumber,
	}
	orders = append(orders, order)
	s.saveOrders(orders)
	return &order
}

func (s *OrderService) UpdateOrder(updated Order) {
	orders := s.readOrdersFromFile()
	for i, o := range orders {
		if o.OrderNumber == updated.OrderNumber {
			orders[i] = updated
			break
		}
	}
	s.saveOrders(orders)
}

func (s *OrderService) DeleteOrder(orderNumber string) bool {
	orders := s.readOrdersFromFile()
	for i, o := range orders {
		if o.OrderNumber == orderNumber {
			orders = append(orders[:i], orders[i+1:]...)
			s.saveOrders(orders)
			return true
		}
	}
	return false
}

func (s *OrderService) MarkCompleted(orderNumber string) bool {
	orders := s.readOrdersFromFile()
	for i, o := range orders {
		if o.OrderNumber == orderNumber {
			orders[i].Completed = true
			s.saveOrders(orders)
			return true
		}
	}
	return false
}

func (s *OrderService) UnmarkCompleted(orderNumber string) bool {
	orders := s.readOrdersFromFile()
	for i, o := range orders {
		if o.OrderNumber == orderNumber {
			orders[i].Completed = false
			s.saveOrders(orders)
			return true
		}
	}
	return false
}

func (s *OrderService) AddDetail(orderNumber string, cells []string) bool {
	orders := s.readOrdersFromFile()
	for i, o := range orders {
		if o.OrderNumber == orderNumber {
			row := DetailRow{}
			if len(cells) > 0 {
				row.Date = cells[0]
			}
			if len(cells) > 1 {
				row.ExchangeRate = cells[1]
			}
			if len(cells) > 2 {
				row.ExecRate = cells[2]
			}
			if len(cells) > 3 {
				row.Country = cells[3]
			}
			if len(cells) > 4 {
				row.Customer = cells[4]
			}
			if len(cells) > 5 {
				row.Product = cells[5]
			}
			if len(cells) > 6 {
				row.RebateRate = cells[6]
			}
			if len(cells) > 7 {
				row.Factory = cells[7]
			}
			if len(cells) > 8 {
				row.FactoryPrice = cells[8]
			}
			if len(cells) > 9 {
				row.Packaging = cells[9]
			}
			if len(cells) > 10 {
				row.ContainerType = cells[10]
			}
			if len(cells) > 11 {
				row.Quantity = cells[11]
			}
			if len(cells) > 12 {
				row.PortOfLoading = cells[12]
			}
			if len(cells) > 13 {
				row.PortOfDestination = cells[13]
			}
			if len(cells) > 14 {
				row.MiscFeeRMB = cells[14]
			}
			if len(cells) > 15 {
				row.FreightUSD = cells[15]
			}
			if len(cells) > 16 {
				row.ProfitRate = cells[16]
			}
			if len(cells) > 17 {
				row.FOBPrice = cells[17]
			}
			if len(cells) > 18 {
				row.CFRPrice = cells[18]
			}
			if len(cells) > 19 {
				row.CIFPrice = cells[19]
			}
			if len(cells) > 20 {
				row.Profit = cells[20]
			}
			orders[i].Details = append(orders[i].Details, row)
			s.saveOrders(orders)
			return true
		}
	}
	return false
}

func (s *OrderService) DeleteDetail(orderNumber string, index int) bool {
	orders := s.readOrdersFromFile()
	for i, o := range orders {
		if o.OrderNumber == orderNumber {
			if index >= 0 && index < len(o.Details) {
				orders[i].Details = append(o.Details[:index], o.Details[index+1:]...)
				s.saveOrders(orders)
				return true
			}
		}
	}
	return false
}

func (s *OrderService) DuplicateDetail(orderNumber string, index int) bool {
	orders := s.readOrdersFromFile()
	for i, o := range orders {
		if o.OrderNumber == orderNumber {
			if index >= 0 && index < len(o.Details) {
				row := o.Details[index]
				row.Copied = true
				details := make([]DetailRow, 0, len(o.Details)+1)
				details = append(details, o.Details[:index+1]...)
				details = append(details, row)
				details = append(details, o.Details[index+1:]...)
				orders[i].Details = details
				s.saveOrders(orders)
				return true
			}
		}
	}
	return false
}

func (s *OrderService) UpdateDetailRow(orderNumber string, index int, row DetailRow) bool {
	orders := s.readOrdersFromFile()
	for i, o := range orders {
		if o.OrderNumber == orderNumber {
			if index >= 0 && index < len(o.Details) {
				orders[i].Details[index] = row
				s.saveOrders(orders)
				return true
			}
		}
	}
	return false
}

func (s *OrderService) GetDetailColWidths() string {
	cfg := s.loadConfig()
	return cfg.DetailColWidths
}

func (s *OrderService) SaveDetailColWidths(widths string) {
	cfg := s.loadConfig()
	cfg.DetailColWidths = widths
	s.saveConfig(cfg)
}

func (s *OrderService) RenameOrder(oldNumber string, newNumber string) bool {
	if oldNumber == newNumber {
		return false
	}
	orders := s.readOrdersFromFile()
	for _, o := range orders {
		if o.OrderNumber == newNumber {
			return false
		}
	}
	for i := range orders {
		if orders[i].OrderNumber == oldNumber {
			orders[i].OrderNumber = newNumber
			s.saveOrders(orders)
			return true
		}
	}
	return false
}

func (s *OrderService) ReloadOrders() []Order {
	s.configPath = ""
	return s.LoadOrders()
}

func (s *OrderService) GetTodayDate() string {
	return time.Now().Format("2006-01-02")
}

func (s *OrderService) ordersFilePath() string {
	if s.configPath == "" {
		s.GetConfigPath()
	}
	return filepath.Join(s.configPath, "orders.yaml")
}

func (s *OrderService) readOrdersFromFile() []Order {
	path := s.ordersFilePath()
	data, err := os.ReadFile(path)
	if err != nil {
		return []Order{}
	}
	var of OrdersFile
	if err := yaml.Unmarshal(data, &of); err != nil {
		return []Order{}
	}
	return of.Orders
}

func (s *OrderService) saveOrders(orders []Order) {
	path := s.ordersFilePath()
	s.writeOrdersFile(path, &OrdersFile{Orders: orders})
}

func (s *OrderService) writeOrdersFile(path string, of *OrdersFile) {
	data, err := yaml.Marshal(of)
	if err != nil {
		return
	}
	os.WriteFile(path, data, 0644)
}
