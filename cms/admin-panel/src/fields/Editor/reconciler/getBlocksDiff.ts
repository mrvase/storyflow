export function createDiffOperations<T extends any[]>(
  firstArray: T,
  secondArray: T,
  options: { compare?: (a: T[number], b: T[number]) => boolean } = {}
) {
  type Operation = {
    index: number;
    remove: number;
    insert: T;
  };

  const { compare = (a: T[number], b: T[number]) => a === b } = options;

  /*
  THIS FUNCTION IS CREATED BY GPT-4
  system: You are an expert algorithm puzzle solver. When given a puzzle, you think through how to solve it with pseudo-code. You then provide an algorithm in javascript with comments explaining each step.
  user: We have two arrays of strings, firstArray and secondArray. We need to create an algorithm that takes the two arrays as inputs and outputs the longest common subsequence. Note that it should return the actual array of the subsequence, not only its length. Adjacent elements of the subsequence do not have to be adjacent in the input arrays. However, it must be the case that if an element comes after another element in the subsequence, then this is true as well for the input arrays.
  */

  function longestCommonSubsequence(firstArray: T, secondArray: T): T {
    // Create a 2D table to store the lengths of common subsequences for different subproblems.
    let table = Array(firstArray.length + 1)
      .fill(null)
      .map(() => Array(secondArray.length + 1).fill(0));

    // Loop through both arrays and populate the table by comparing the elements of the arrays.
    for (let i = 1; i <= firstArray.length; i++) {
      for (let j = 1; j <= secondArray.length; j++) {
        // If the elements match, increment the value in the table by adding 1 to the value from the previous row and column.
        if (compare(firstArray[i - 1], secondArray[j - 1])) {
          table[i][j] = table[i - 1][j - 1] + 1;
        } else {
          // If the elements don't match, take the maximum value from the previous row or column.
          table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
        }
      }
    }

    // Initialize an empty array to store the longest common subsequence.
    let subsequence = [] as unknown as T;
    // Start from the bottom-right corner of the table.
    let i = firstArray.length;
    let j = secondArray.length;

    // Backtrace from the bottom-right corner of the table to the top-left corner while building the longest common subsequence.
    while (i > 0 && j > 0) {
      // If the elements match, add the element to the subsequence and move diagonally up to the left.
      if (compare(firstArray[i - 1], secondArray[j - 1])) {
        subsequence.unshift(firstArray[i - 1]);
        i--;
        j--;
      } else if (table[i - 1][j] > table[i][j - 1]) {
        // If the value in the previous row is greater, move up.
        i--;
      } else {
        // If the value in the previous column is greater or equal, move left.
        j--;
      }
    }

    // Return the longest common subsequence.
    return subsequence;
  }

  function createSpliceOperations(
    firstArray: T,
    secondArray: T,
    longestCommonSubsequence: T
  ): Operation[] {
    // Initialize an empty array to store the splice operations.
    let operations: Operation[] = [];

    // Initialize three variables to keep track of the current index in the first array, second array, and longest common subsequence.
    let idx1 = 0;
    let idx2 = 0;
    let idxLCS = 0;

    const LCSLength = longestCommonSubsequence.length;

    let adjustLength = 0;

    while (idxLCS < LCSLength) {
      const currentLCS = longestCommonSubsequence[idxLCS];

      let index = idx1;

      let remove = 0;
      // Find the elements from the first array to remove by increasing the index until we hit the next common element
      while (!compare(firstArray[idx1], currentLCS)) {
        remove++;
        idx1++;
      }

      let insert = [] as unknown as T;
      // Similarly, find the elements from the second array to insert by increasing the index until we hit the next common element
      while (!compare(secondArray[idx2], currentLCS)) {
        insert.push(secondArray[idx2]);
        idx2++;
      }

      // Add the operation if there is something to remove or insert.
      if (remove !== 0 || insert.length !== 0) {
        adjustLength += insert.length - remove;
        operations.push({
          index,
          remove,
          insert,
        });
      }

      // the indexes are now on the common element, which we should ignore, so we move the indexes up
      idx1++;
      idx2++;

      // Repeat the procedure up until the next common element.
      idxLCS++;
    }

    // What comes after the last common element is handled in one operation.
    if (idx1 < firstArray.length || idx2 < secondArray.length) {
      operations.push({
        index: idx1 + adjustLength,
        remove: firstArray.length - idx1,
        insert: secondArray.slice(idx2) as T,
      });
    }

    // Return the operations array.
    return operations;
  }

  function performSpliceOperations(firstArray: T, operations: Operation[]) {
    for (let i = 0; i < operations.length; i++) {
      const { index, remove, insert } = operations[i];
      firstArray.splice(index, remove, ...insert);
    }
  }

  function compareArrays(firstArray: T, secondArray: T) {
    return (
      firstArray.length === secondArray.length &&
      firstArray.every((el, i) => compare(el, secondArray[i]))
    );
  }

  const lcs = longestCommonSubsequence(firstArray, secondArray);
  const operations = createSpliceOperations(firstArray, secondArray, lcs);

  // Test the algorithm
  const testCase = firstArray.slice() as T;
  performSpliceOperations(testCase, operations);
  if (!compareArrays(testCase, secondArray)) {
    console.log("Algorithm failed", {
      firstArray,
      testCase,
      secondArray,
      operations,
    });
    throw new Error("Algorithm failed");
  }

  return operations;
}
