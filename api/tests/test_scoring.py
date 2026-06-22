from app.models import Concept
from app.scoring import assess_answer


def _concept() -> Concept:
    return Concept(
        name="Eigenvector",
        slug="eigenvector",
        importance=4,
        intuition="An eigenvector is a direction left unchanged in orientation by a "
        "transformation; it is only scaled by an eigenvalue lambda.",
    )


def test_empty_answer_scores_zero():
    a = assess_answer(_concept(), "")
    assert a.score == 0
    assert a.label == "Forgot"


def test_thorough_answer_outscores_sparse_answer():
    concept = _concept()
    thorough = assess_answer(
        concept,
        "An eigenvector is a direction left unchanged in orientation by a "
        "transformation; it is only scaled by an eigenvalue lambda.",
    )
    sparse = assess_answer(concept, "something about a matrix")
    assert thorough.score > sparse.score
    assert 0 <= sparse.score <= 3
    assert thorough.score == 3


def test_score_is_always_in_range_and_has_label():
    for answer in ["", "a", "eigenvector direction scaled", "x" * 200]:
        a = assess_answer(_concept(), answer)
        assert 0 <= a.score <= 3
        assert a.label
        assert a.assessed_by == "heuristic-v1"
