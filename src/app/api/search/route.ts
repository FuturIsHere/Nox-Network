import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/client";

export async function GET(request: NextRequest) {
  const searchQuery = request.nextUrl.searchParams.get("q");

  if (!searchQuery || searchQuery.trim() === "") {
    return NextResponse.json([]);
  }

  try {
    // Improved query for Next.js 15.3.1
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { 
            username: { 
              contains: searchQuery 
            } 
          },
          { 
            name: { 
              contains: searchQuery,
              // Ensure we only search in non-null fields
              not: null
            } 
          },
          { 
            surname: { 
              contains: searchQuery,
              not: null
            } 
          },
        ],
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        name: true,
        surname: true,
      },
      take: 5,
    });

    // Format results with proper type checking
    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      avatar: user.avatar || "/noAvatar.png",
      name: user.name && user.surname 
        ? `${user.name} ${user.surname}` 
        : user.name || undefined,
    }));

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error("Erreur lors de la recherche d'utilisateurs:", error);
    return NextResponse.json([], { status: 500 }); // Better to return 500 for server errors
  }
}