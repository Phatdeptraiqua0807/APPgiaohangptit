from openai import OpenAI
import os

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key="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",
)

resp = client.chat.completions.create(
    model="gemma-4-31b-it",
    messages=[
        {"role": "user", "content": "Reply in one line: API works."}
    ],
    max_tokens=40,
)
print(resp.choices[0].message.content)

