export default function determineSpecies(gene: string) {
    if (gene.toUpperCase() === gene) return 'human';
    return 'mouse';
  }