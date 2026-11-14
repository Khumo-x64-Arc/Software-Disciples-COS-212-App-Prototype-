// Turns on-screen notation into words a speech engine reads clearly,
// e.g. "R⁺[a][c]" becomes "R plus, row a column c".
export function toSpoken(text: string): string {
  return text
    .replace(/Θ\(([^)]+)\)/g, 'theta of $1')
    .replace(/O\(([^)]+)\)/g, 'order $1')
    .replace(/V³/g, 'V cubed')
    .replace(/n³/g, 'n cubed')
    .replace(/V²/g, 'V squared')
    .replace(/n²/g, 'n squared')
    .replace(/R⁺/g, 'R plus')
    .replace(/R\((\w+)\)/g, 'R $1')
    .replace(/\[(\w+)\]\[(\w+)\]/g, ' row $1 column $2')
    .replace(/K([₀-₉]+)/g, (_, d: string) => `K ${[...d].map(c => '₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).join('')}`)
    .replace(/Kₙ/g, 'K n')
    .replace(/dist\(([^)]+)\)/g, 'distance of $1')
    .replace(/→/g, ' to ')
    .replace(/ – /g, ' to ')
    .replace(/∞/g, 'infinity')
    .replace(/[−-](?=\d)/g, 'minus ')
    .replace(/ − /g, ' minus ')
    .replace(/×/g, ' times ')
    .replace(/\+(?=\d)/g, 'plus ')
    .replace(/ \+ /g, ' plus ')
    .replace(/ = /g, ' equals ')
    .replace(/≥/g, ' at least ')
    .replace(/≤/g, ' at most ')
    .replace(/[{}]/g, ' ')
    .replace(/·/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
