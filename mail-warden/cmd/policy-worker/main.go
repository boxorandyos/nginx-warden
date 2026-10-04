package main

import (
	"log"
	"time"
)

func main() {
	log.Println("policy-worker started (bootstrap mode)")
	t := time.NewTicker(30 * time.Second)
	defer t.Stop()

	for range t.C {
		log.Println("policy-worker heartbeat")
	}
}
