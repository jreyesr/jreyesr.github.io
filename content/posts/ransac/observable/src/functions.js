/**
 * @param {T[]} array
 * @returns The same array, modified to be now shuffled
 * @see https://bost.ocks.org/mike/shuffle/ by one of the original devs of Observable!
 */
export function shuffle(array) {
  var m = array.length,
    t,
    i;

  // While there remain elements to shuffle…
  while (m) {
    // Pick a remaining element…
    i = Math.floor(Math.random() * m--);

    // And swap it with the current element.
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }

  return array;
}
