export type Destination = {
  nom: string;
  labels: string[];
  accessibleHandicap: "oui" | "non";
  /** Indicative price per person, in euros */
  prixParPersonne: number;
};

export const destinations: Destination[] = [
  {
    nom: "Randonnée camping en Lozère",
    labels: ["sport", "montagne", "campagne"],
    accessibleHandicap: "non",
    prixParPersonne: 180,
  },
  {
    nom: "5 étoiles à Chamonix option fondue",
    labels: ["montagne", "détente"],
    accessibleHandicap: "oui",
    prixParPersonne: 890,
  },
  {
    nom: "5 étoiles à Chamonix option ski",
    labels: ["montagne", "sport"],
    accessibleHandicap: "non",
    prixParPersonne: 950,
  },
  {
    nom: "Palavas de paillotes en paillotes",
    labels: ["plage", "ville", "détente", "paillote"],
    accessibleHandicap: "oui",
    prixParPersonne: 420,
  },
  {
    nom: "5 étoiles en rase campagne",
    labels: ["campagne", "détente"],
    accessibleHandicap: "oui",
    prixParPersonne: 610,
  },
];

/** Label mapping from criteria keys to destination label strings */
export const criteriaToLabel: Record<string, string> = {
  plage: "plage",
  montagne: "montagne",
  ville: "ville",
  sport: "sport",
  detente: "détente",
  acces_handicap: "acces_handicap", // handled separately via accessibleHandicap field
};
