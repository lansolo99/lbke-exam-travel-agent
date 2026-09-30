import os
from urllib.parse import urlsplit

import httpx
from giskard_hub import HubClient

TUNNEL_URL = "https://madrid-bikes-reproduced-establish.trycloudflare.com"

INPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "location": {
            "type": "string",
            "description": "Free-text location or environment the traveler is looking for (e.g. 'montagne', 'Chamonix', 'plage', 'ville').",
        },
        "maxPrice": {
            "type": "number",
            "description": "Maximum price per person, in euros.",
        },
    },
    "required": ["location", "maxPrice"],
}

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "message": {
            "type": "string",
            "description": "Human-readable summary accompanying the results",
        },
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "nom": {"type": "string"},
                    "labels": {"type": "array", "items": {"type": "string"}},
                    "accessibleHandicap": {"type": "string", "enum": ["oui", "non"]},
                    "prixParPersonne": {"type": "number"},
                },
                "required": ["nom", "labels", "accessibleHandicap", "prixParPersonne"],
            },
        },
    },
    "required": ["message", "results"],
}


def register_and_test(config, agent_id=None):
    url = urlsplit(config["url"])
    if url.scheme != "https" or not url.hostname:
        raise ValueError("Hub requires a complete HTTPS endpoint URL")
    wrapper_key = os.environ["AGENT_WRAPPER_API_KEY"]
    if not wrapper_key:
        raise ValueError("AGENT_WRAPPER_API_KEY must not be empty")

    params = dict(config)
    project_id = params.pop("project_id")
    params["headers"] = {"X-API-Key": wrapper_key}
    with HubClient(
        base_url=os.environ["GISKARD_HUB_BASE_URL"],
        api_key=os.environ["GISKARD_HUB_API_KEY"],
        max_retries=0,
        # Local Hub instance uses a self-signed cert; the wrapper/tunnel URL
        # registered as the agent's `url` is verified normally by Hub itself.
        http_client=httpx.Client(verify=False),
    ) as hub:
        if agent_id:
            agent = hub.agents.update(agent_id, **params)
        else:
            agent = hub.agents.create(project_id=project_id, **params)
        print(f"Hub agent ID: {agent.id}")
        result = hub.agents.test_connection(
            agent_id=agent.id,
            url=params["url"],
            project_id=project_id,
            headers=params["headers"],
            input_schema=params["input_schema"],
        )
        return agent.id, result


if __name__ == "__main__":
    config = {
        "project_id": os.environ["GISKARD_HUB_PROJECT_ID"],
        "name": "Travel Search (Structured)",
        "description": "Structured search over the travel catalog: given a location and an optional max price per person, returns matching travel offers.",
        "url": f"{TUNNEL_URL}/giskard/invoke",
        "supported_languages": ["fr", "en"],
        "input_schema": INPUT_SCHEMA,
        "output_schema": OUTPUT_SCHEMA,
        "auto_bindings": [],
    }
    agent_id, result = register_and_test(config, agent_id="fc6f9fc7-8f64-44d3-aed0-af058a01920b")
    print("test_connection result:", result)
