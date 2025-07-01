import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isProtectedRoute = createRouteMatcher(["/settings(.*)", "/"]);

export default clerkMiddleware(async (auth, req) => {
  // Gérer les requêtes Socket.IO
  if (req.nextUrl.pathname.startsWith('/socket.io')) {
    const response = NextResponse.next();
    
    // Headers CORS pour Socket.IO
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    return response;
  }

  if (isProtectedRoute(req)) {
    await auth().protect();
  }
});

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", 
    "/", 
    "/(api|trpc)(.*)",
    "/socket.io(.*)" // Ajouter le matcher pour Socket.IO
  ],
};