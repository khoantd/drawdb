import { useContext } from "react";
import { AIContext } from "../context/AIContext";

export function useAI() {
  const context = useContext(AIContext);
  
  if (!context) {
    throw new Error("useAI must be used within an AIContextProvider");
  }
  
  return context;
}
