"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type User = {
  id: string;
  username: string;
  avatar?: string;
  name?: string;
  surname?: string;
};

export default function NewConversation() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (query.trim().length > 0) {
        setLoading(true);
        try {
          const response = await fetch(`/api/messages/search-users?q=${encodeURIComponent(query.trim())}`);
          if (response.ok) {
            const data = await response.json();
            setResults(Array.isArray(data) ? data : []);
          } else {
            setResults([]);
          }
        } catch (error) {
          console.error("Erreur lors de la recherche:", error);
          setResults([]);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  // Au lieu de créer la conversation, on redirige vers une vue de conversation temporaire
  const startConversationWith = (user: User) => {
    // Encoder l'ID utilisateur pour éviter les problèmes de routage
    const encodedUserId = encodeURIComponent(user.id);
    router.push(`/messages/new/${encodedUserId}`);
  };

  const getUserDisplayName = (user: User) => {
    return (user.name && user.surname) ? `${user.name} ${user.surname}` : user.username;
  };

  return (
    <div className="h-screen bg-white flex flex-col rounded-[30px] shadow-md ">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 rounded-t-[30px]">
        <div className="flex items-center mb-4">
          <button
            onClick={() => router.back()}
            className="mr-3 p-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-semibold">Nouvelle conversation</h1>
        </div>

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-gray-100 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Résultats de recherche */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        )}

        {!loading && query.trim().length > 0 && results.length === 0 && (
          <div className="flex items-center justify-center p-8">
            <p className="text-gray-500">Aucun utilisateur trouvé</p>
          </div>
        )}

        {!loading && query.trim().length === 0 && (
          <div className="flex items-center justify-center p-8">
            <p className="text-gray-500">Tapez un nom pour rechercher des utilisateurs</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="divide-y divide-gray-100">
            {results.map((user) => (
              <button
                key={user.id}
                onClick={() => startConversationWith(user)}
                className="flex items-center w-full p-4 hover:bg-gray-50"
              >
                <div className="relative">
                  <Image
                    src={user.avatar || '/noAvatar.png'}
                    alt={getUserDisplayName(user)}
                    width={48}
                    height={48}
                    className="rounded-full object-cover w-12 h-12"
                  />
                </div>

                <div className="ml-4 flex-1 text-left">
                  <h3 className="font-medium text-gray-900">
                    {getUserDisplayName(user)}
                  </h3>
                  <p className="text-sm text-gray-500">@{user.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}