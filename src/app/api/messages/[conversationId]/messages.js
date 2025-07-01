import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import { getConversationMessages, sendMessage } from "@/lib/action";

export default async function handler(req, res) {
  const { conversationId } = req.query;
  const { userId } = auth(req);

  if (!userId) {
    return res.status(401).json({ error: "Non autorisé" });
  }

  try {
    if (req.method === 'GET') {
      // Récupérer les messages avec pagination
      const offset = parseInt(req.query.offset) || 0;
      const limit = parseInt(req.query.limit) || 20;
      
      console.log(`API: Getting messages for conversation ${conversationId} with offset: ${offset}, limit: ${limit}`);
      
      const messages = await getConversationMessages(conversationId, offset, limit);
      return res.status(200).json(messages);
      
    } else if (req.method === 'POST') {
      // Envoyer un nouveau message
      const { content, type = 'TEXT', mediaUrl } = req.body;
      
      if (!content?.trim()) {
        return res.status(400).json({ error: "Le contenu du message est requis" });
      }
      
      console.log(`API: Sending message to conversation ${conversationId}`);
      
      const newMessage = await sendMessage(conversationId, content, type, mediaUrl);
      
      // Le message sera envoyé via Socket.IO côté client
      return res.status(201).json(newMessage);
      
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Méthode ${req.method} non autorisée` });
    }
  } catch (error) {
    console.error('Erreur API messages:', error);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
}