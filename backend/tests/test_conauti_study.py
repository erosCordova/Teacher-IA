from datetime import datetime, timezone, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.conauti_study import (
    recommendations, next_review, parse_cards, NewCard, Review, SCHEMA
) 


def test_unassessed_recommendations_do_not_claim_mastery():
    result=recommendations([],[])
    assert len(result)==2
    assert all(item["mastery"] is None for item in result)
    assert all(item["evidence"]=="sin evaluación" for item in result)


def test_weak_results_prioritized_but_no_diagnosis():
    result=recommendations(
        [("biología",1,"Le cuesta el tema","Repasar anatomía"),
         ("historia",4,"","Avanzar al tema siguiente")],
        [("fracciones",5,1),("ecuaciones",5,5)]
    )
    assert result[0]["priority"]==3
    assert any(r["topic"]=="fracciones" and r["priority"]==3 for r in result)
    assert any(r["topic"]=="historia" and r["priority"]==1 for r in result)


def test_spaced_repetition_schedule():
    now=datetime(2026,11,6,tzinfo=timezone.utc)
    initial=next_review(0,0,2.5,"bien",now)
    assert initial[0]==1 and initial[1]==1
    assert initial[3]==now+timedelta(days=1)
    forgotten=next_review(*initial[:3],"olvidé",now)
    assert forgotten[0]==0 and forgotten[1]==0
    assert forgotten[3]==now+timedelta(minutes=10)
    assert 1.3<=forgotten[2]<=3


def test_interval_does_not_grow_without_limit():
    schedule=next_review(15,90,2.9,"fácil",
                         datetime(2026,11,6,tzinfo=timezone.utc))
    assert schedule[1]<=90


def test_generated_cards_are_validated_against_document_pages():
    text='{"cards":[{"question":"¿Qué es la célula?","answer":"Es la unidad básica de los seres vivos.","page":2},{"question":"¿Qué hace una membrana?","answer":"Regula el intercambio de sustancias.","page":3}]}'
    cards=parse_cards(text,{2,3})
    assert len(cards)==2
    with pytest.raises(ValueError):
        parse_cards(text,{1,4})


def test_prevent_invalid_card_and_rating():
    with pytest.raises(ValidationError):
        NewCard(topic="a",question="x",answer="y")
    with pytest.raises(ValidationError):
        Review(rating="perfecto")


def test_schema_is_user_isolated_and_cascades_account_deletion():
    assert "REFERENCES public.conauti_users(id) ON DELETE CASCADE" in SCHEMA
    assert "UNIQUE(user_id,topic,question)" in SCHEMA
