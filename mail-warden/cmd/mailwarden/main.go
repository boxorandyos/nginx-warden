package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/boxorandyos/mail-warden/internal/policy"
)

func main() {
	configPath := flag.String("config", "./configs/mailwarden.example.yaml", "path to service config")
	addr := flag.String("listen", ":8080", "http listen address")
	flag.Parse()

	engine := policy.NewEngine(policy.DefaultEngineConfig())

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	mux.HandleFunc("/api/v1/policy/simulate", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		decision, err := policy.DecodeAndEvaluate(r.Body, engine)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if err := decision.WriteJSON(w); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})

	s := &http.Server{
		Addr:              *addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("mailwarden starting on %s (config=%s)", *addr, *configPath)
	if err := s.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(fmt.Errorf("mailwarden exited: %w", err))
	}
}
