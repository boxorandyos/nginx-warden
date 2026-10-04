package policy

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/boxorandyos/mail-warden/internal/scoring"
)

type Engine struct {
	scoring *scoring.Engine
}

func NewEngine(cfg scoring.EngineConfig) *Engine {
	return &Engine{
		scoring: scoring.NewEngine(cfg),
	}
}

func DefaultEngineConfig() scoring.EngineConfig {
	return scoring.DefaultEngineConfig()
}

func (e *Engine) Evaluate(n scoring.NormalizedDecisionObject) scoring.Decision {
	return e.scoring.Evaluate(n)
}

type DecisionResponse struct {
	Decision scoring.Decision `json:"decision"`
}

func (r DecisionResponse) WriteJSON(w io.Writer) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(r)
}

func DecodeAndEvaluate(r io.Reader, e *Engine) (DecisionResponse, error) {
	var n scoring.NormalizedDecisionObject
	dec := json.NewDecoder(r)
	if err := dec.Decode(&n); err != nil {
		return DecisionResponse{}, fmt.Errorf("decode normalized object: %w", err)
	}

	return DecisionResponse{
		Decision: e.Evaluate(n),
	}, nil
}

func WriteHTTPJSON(w http.ResponseWriter, status int, payload any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(payload)
}
