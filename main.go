package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := application.New(application.Options{
		Name:        "OrdersTrack",
		Description: "订单发货跟踪系统",
		Services: []application.Service{
			application.NewService(&OrderService{}),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "OrdersTrack - 订单发货跟踪",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		Width:            1280,
		Height:           768,
		MinWidth:         800,
		MinHeight:        500,
		URL:              "/",
	})

	err := app.Run()
	if err != nil {
		log.Fatal(err)
	}
}
