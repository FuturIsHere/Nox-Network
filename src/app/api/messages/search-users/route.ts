import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/client";

// GET - Rechercher des utilisateurs pour créer une nouvelle conversation
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json([]);
    }

    const searchTerm = query.trim();

    // Rechercher des utilisateurs (excluant l'utilisateur actuel)
 // Rechercher des utilisateurs (excluant l'utilisateur actuel)
const users = await prisma.user.findMany({
  where: {
    AND: [
      {
        id: {
          not: userId
        }
      },
      {
        OR: [
          {
            username: {
              contains: searchTerm
            }
          },
          {
            name: {
              contains: searchTerm
            }
          },
          {
            surname: {
              contains: searchTerm
            }
          }
        ]
      }
    ]
  },
  select: {
    id: true,
    username: true,
    name: true,
    surname: true,
    avatar: true
  },
  take: 10 // Limiter les résultats
});

    return NextResponse.json(users);
  } catch (error) {
    console.error("Erreur lors de la recherche d'utilisateurs:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}