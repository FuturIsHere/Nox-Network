"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  username: string;
  avatar: string;
  name?: string;
};

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mounted, setMounted] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (query.trim().length > 0) {
        setLoading(true);
        try {
          const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }
          const data = await response.json();
          setResults(Array.isArray(data) ? data : []);
          setShowResults(true);
        } catch (error) {
          console.error("Error while searching:", error);
          setResults([]);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node) &&
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function navigateToProfile(username: string) {
    document.location.href = `/profile/${username}`;
  }

  return (
    <div className="relative" ref={searchContainerRef}>
      <div className="flex p-[5px] bg-transparent items-center rounded-[99px] border-[1px] border-white">
        <input
          type="text"
          placeholder="Search for users..."
          className="bg-transparent outline-none text-sm w-full"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length > 0 && setShowResults(true)}
        />
        {loading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
        ) : (
          <Image src="/search.png" alt="Search" width={14} height={14} />
        )}
      </div>

      {mounted && showResults && createPortal(
        <>
          <div
            ref={resultsRef}
            className="fixed left-1/2 top-20 transform -translate-x-1/2 min-w-[320px] min-w-[350px] bg-black/65 backdrop-blur-[9.4px] border-[1px] border-solid border-gray-500 rounded-[20px] shadow-lg z-50 max-h-[300px] overflow-y-auto"
          >
            {results.length > 0 ? (
              <div className="py-2">
                {results.slice(0, 5).map((user) => (
                  <button
                    key={user.id}
                    className="flex items-center w-full px-3 py-2 hover:bg-gray-100/25 cursor-pointer text-left"
                    onClick={() => navigateToProfile(user.username)}
                  >
                    <div className="w-10 h-10 relative rounded-full overflow-hidden mr-3">
                      <Image
                        src={user.avatar || "/noAvatar.png"}
                        alt={user.username}
                        width={40}
                        height={40}
                        className="object-cover"
                        priority
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white antialiased">@{user.username}</p>
                      <p className="text-white/50 text-sm antialiased">
                        {user.name ? user.name : user.username}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-white/50">
                No users found
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}