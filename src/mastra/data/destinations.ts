export type Destination = {
  nom: string;
  labels: string[];
  accessibleHandicap: "oui" | "non";
};

export const destinations: Destination[] = [
  {
    nom: "Randonnée camping en Lozère",
    labels: ["sport", "montagne", "campagne"],
    accessibleHandicap: "non",
  },
  {
    nom: "5 étoiles à Chamonix option fondue",
    labels: ["montagne", "détente"],
    accessibleHandicap: "oui",
  },
  {
    nom: "5 étoiles à Chamonix option ski",
    labels: ["montagne", "sport"],
    accessibleHandicap: "non",
  },
  {
    nom: "Palavas de paillotes en paillotes",
    labels: ["plage", "ville", "détente", "paillote"],
    accessibleHandicap: "oui",
  },
  {
    nom: "5 étoiles en rase campagne",
    labels: ["campagne", "détente"],
    accessibleHandicap: "oui",
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
