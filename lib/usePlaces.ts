"use client";

import { useEffect, useMemo, useState } from "react";
import { isFirebaseConfigured } from "./firebase";
import {
  deletePlace,
  savePlace,
  subscribePlaceSettings,
  subscribePlaces,
  subscribeVotes,
  toggleAttractionVote,
  toggleStayVote,
  updatePlaceSettings,
} from "./places";
import type {
  Member,
  Place,
  PlaceInput,
  PlaceSettings,
  VoteDoc,
  VotingResults,
} from "./types";
import { calculateVotingResults } from "./voting";

interface UsePlacesReturn {
  places: Place[] | undefined;
  votes: VoteDoc[] | undefined;
  settings: PlaceSettings | null | undefined;
  results: VotingResults;
  myVote: VoteDoc | undefined;
  isLoading: boolean;
  error: string | null;
  // Actions
  onSavePlace: (input: PlaceInput, placeId?: string) => Promise<string>;
  onDeletePlace: (placeId: string) => Promise<void>;
  onUpdateSettings: (settings: Partial<PlaceSettings>) => Promise<void>;
  onVoteStay: (stayId: string) => Promise<void>;
  onVoteAttraction: (attractionId: string) => Promise<void>;
}

export function usePlaces(
  roomId: string,
  members: Member[] = [],
  uid: string | null,
): UsePlacesReturn {
  const [places, setPlaces] = useState<Place[] | undefined>(undefined);
  const [votes, setVotes] = useState<VoteDoc[] | undefined>(undefined);
  const [settings, setSettings] = useState<PlaceSettings | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !roomId) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    const fail = (e: Error) => {
      if (!cancelled) setError(e.message);
    };

    unsubs.push(
      subscribePlaces(
        roomId,
        (p) => {
          if (!cancelled) setPlaces(p);
        },
        fail,
      ),
    );

    unsubs.push(
      subscribeVotes(
        roomId,
        (v) => {
          if (!cancelled) setVotes(v);
        },
        fail,
      ),
    );

    unsubs.push(
      subscribePlaceSettings(
        roomId,
        (s) => {
          if (!cancelled) setSettings(s);
        },
        fail,
      ),
    );

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [roomId]);

  const results = useMemo(() => {
    return calculateVotingResults(places || [], votes || [], members);
  }, [places, votes, members]);

  const myVote = useMemo(() => {
    if (!uid || !votes) return undefined;
    return votes.find((v) => v.id === uid);
  }, [uid, votes]);

  const handleSavePlace = async (input: PlaceInput, placeId?: string) => {
    return await savePlace(roomId, input, placeId);
  };

  const handleDeletePlace = async (placeId: string) => {
    await deletePlace(roomId, placeId);
  };

  const handleUpdateSettings = async (newSettings: Partial<PlaceSettings>) => {
    await updatePlaceSettings(roomId, newSettings);
  };

  const handleVoteStay = async (stayId: string) => {
    if (!uid) return;
    const currentStays = myVote?.stayIds ?? (myVote?.stayId ? [myVote.stayId] : []);
    await toggleStayVote(roomId, uid, stayId, currentStays);
  };


  const handleVoteAttraction = async (attractionId: string) => {
    if (!uid) return;
    const currentAttractions = myVote?.attractionIds || [];
    await toggleAttractionVote(roomId, uid, attractionId, currentAttractions);
  };

  const isLoading = places === undefined || votes === undefined;

  return {
    places,
    votes,
    settings,
    results,
    myVote,
    isLoading,
    error,
    onSavePlace: handleSavePlace,
    onDeletePlace: handleDeletePlace,
    onUpdateSettings: handleUpdateSettings,
    onVoteStay: handleVoteStay,
    onVoteAttraction: handleVoteAttraction,
  };
}
