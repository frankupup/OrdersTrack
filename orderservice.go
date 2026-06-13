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
	Path         string `json:"path"`
	SortDir      string `json:"sort_dir"`
	ColumnWidths string `json:"column_widths"`
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
