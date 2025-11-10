#!/usr/bin/env python3
"""Generate LiveKit access token with workflow metadata for agent dispatch."""

import argparse
import json
import os
import sys

from dotenv import load_dotenv
from livekit import api

# Load environment variables from .env.local
load_dotenv(".env.local")


def create_token_with_workflow(
    room_name: str,
    workflow_id: str,
    version_id: str | None = None,
    agent_name: str = "starteragent",
    participant_identity: str = "test-participant",
    participant_name: str = "Test Participant",
) -> str:
    """
    Create a LiveKit access token with workflow dispatch metadata.

    Args:
        room_name: Name of the room to join
        workflow_id: UUID of the workflow to load
        version_id: Optional specific workflow version UUID
        agent_name: Agent worker name to dispatch (must match worker configuration)
        participant_identity: Unique identifier for the participant
        participant_name: Display name for the participant

    Returns:
        JWT token string
    """
    # Get LiveKit credentials from environment
    livekit_api_key = os.getenv("LIVEKIT_API_KEY")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")

    if not livekit_api_key or not livekit_api_secret:
        raise ValueError(
            "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set in environment"
        )

    # Build metadata payload
    metadata = {"workflow_id": workflow_id}
    if version_id:
        metadata["version_id"] = version_id

    # Create access token with room configuration
    token = (
        api.AccessToken(livekit_api_key, livekit_api_secret)
        .with_identity(participant_identity)
        .with_name(participant_name)
        .with_grants(api.VideoGrants(room_join=True, room=room_name))
        .with_room_config(
            api.RoomConfiguration(
                agents=[
                    api.RoomAgentDispatch(
                        agent_name=agent_name,
                        metadata=json.dumps(metadata),
                    )
                ],
            ),
        )
        .to_jwt()
    )

    return token


def main():
    """CLI entrypoint for token generation."""
    parser = argparse.ArgumentParser(
        description="Generate LiveKit access token with workflow metadata"
    )
    parser.add_argument(
        "--room",
        required=True,
        help="Room name to join",
    )
    parser.add_argument(
        "--workflow-id",
        required=True,
        help="Workflow UUID to load",
    )
    parser.add_argument(
        "--version-id",
        help="Optional workflow version UUID",
    )
    parser.add_argument(
        "--agent-name",
        default="starteragent",
        help="Agent worker name (default: starteragent)",
    )
    parser.add_argument(
        "--identity",
        default="test-participant",
        help="Participant identity (default: test-participant)",
    )
    parser.add_argument(
        "--name",
        default="Test Participant",
        help="Participant display name (default: Test Participant)",
    )

    args = parser.parse_args()

    try:
        token = create_token_with_workflow(
            room_name=args.room,
            workflow_id=args.workflow_id,
            version_id=args.version_id,
            agent_name=args.agent_name,
            participant_identity=args.identity,
            participant_name=args.name,
        )

        print("\n" + "=" * 80)
        print("LiveKit Access Token Generated Successfully")
        print("=" * 80)
        print(f"\nRoom: {args.room}")
        print(f"Workflow ID: {args.workflow_id}")
        if args.version_id:
            print(f"Version ID: {args.version_id}")
        print(f"Agent Name: {args.agent_name}")
        print(f"\nAccess Token:")
        print("-" * 80)
        print(token)
        print("-" * 80)
        print("\nNext Steps:")
        print("1. Start the LiveKit worker: uv run python -m backend.worker")
        print("2. Open LiveKit Agents Playground: https://agents-playground.livekit.io/")
        print(f"3. Join room '{args.room}' using the token above")
        print("4. Start talking to test the workflow!\n")

    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()










