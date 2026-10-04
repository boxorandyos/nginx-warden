package scoring

import "testing"

func TestEvaluateHardSignalWins(t *testing.T) {
	e := NewEngine(DefaultEngineConfig())

	d := e.Evaluate(NormalizedDecisionObject{
		Content: ContentFacts{
			MalwareConfirmed: true,
		},
	})

	if d.Action != ActionReject {
		t.Fatalf("expected reject, got %s", d.Action)
	}
}

func TestEvaluateScoreBasedQuarantine(t *testing.T) {
	e := NewEngine(DefaultEngineConfig())

	d := e.Evaluate(NormalizedDecisionObject{
		Identity: IdentityFacts{
			SenderReputation: 2,
			DomainReputation: 1,
		},
		Relationship: RelationshipFacts{
			KnownCorrespondent: true,
			InteractionCount:   80,
		},
		Authentication: AuthenticationFacts{
			SPF:   "fail",
			DKIM:  "fail",
			DMARC: "fail",
		},
		Envelope: EnvelopeFacts{
			InvalidRatio: 0.35,
		},
		Content: ContentFacts{
			RspamdScore:  12,
			MaliciousURL: false,
		},
	})

	if d.Action != ActionQuarantine {
		t.Fatalf("expected quarantine, got %s with score %.2f", d.Action, d.Score)
	}
}
