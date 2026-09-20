"""
AI inference abstraction used by the orchestrator.

This package hides *where* the LLM actually runs. The orchestrator only calls
`ai_service.factory.get_backend()` and then `.generate(prompt)` on whatever it
gets back — it never imports torch/transformers directly, so the rest of the
app works fine even if those heavy packages are not installed.
"""
