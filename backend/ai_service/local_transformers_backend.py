"""
Runs a Hugging Face Transformers model directly in this process.

This is the "real GPU" path: it loads actual model weights (e.g.
mistralai/Mistral-7B-Instruct-v0.2 or meta-llama/Meta-Llama-3-8B-Instruct) with
`transformers` + `torch` and calls `model.generate()` locally. For a 7B/8B
model you need a GPU with roughly 16GB VRAM, or pass load_in_4bit=True to fit
it on a smaller GPU via bitsandbytes quantisation. For CPU-only laptop
development, point LLM_MODEL_NAME at a small instruct model instead (e.g.
"Qwen/Qwen2.5-0.5B-Instruct" or "TinyLlama/TinyLlama-1.1B-Chat-v1.0").

`transformers`/`torch` are only imported here, inside __init__ — so the rest
of the app (and its default requirements.txt / Docker image) never needs to
install them unless LLM_BACKEND=local_transformers is actually selected. See
backend/requirements-llm.txt.
"""
from __future__ import annotations

from .interface import AIBackend, AIBackendError


class LocalTransformersBackend(AIBackend):
    def __init__(self, model_name: str, load_in_4bit: bool = False) -> None:
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError as exc:
            raise AIBackendError(
                "transformers/torch are not installed. Run: "
                "pip install -r backend/requirements-llm.txt"
            ) from exc

        self.model_name = model_name
        self._torch = torch

        self.tokenizer = AutoTokenizer.from_pretrained(model_name)

        load_kwargs: dict = {"device_map": "auto"}
        if load_in_4bit:
            from transformers import BitsAndBytesConfig

            load_kwargs["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True)

        try:
            self.model = AutoModelForCausalLM.from_pretrained(model_name, **load_kwargs)
        except Exception as exc:
            raise AIBackendError(f"failed to load model '{model_name}': {exc}") from exc

    def generate(self, prompt: str, max_new_tokens: int = 400) -> str:
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)
        try:
            with self._torch.no_grad():
                output_ids = self.model.generate(
                    **inputs,
                    max_new_tokens=max_new_tokens,
                    do_sample=True,
                    temperature=0.7,
                    pad_token_id=self.tokenizer.eos_token_id,
                )
        except Exception as exc:
            raise AIBackendError(f"generation failed: {exc}") from exc

        full_text = self.tokenizer.decode(output_ids[0], skip_special_tokens=True)
        # Instruct models typically echo the prompt back before their answer;
        # strip it so callers only get the newly generated marketing copy.
        if full_text.startswith(prompt):
            return full_text[len(prompt):].strip()
        return full_text.strip()
