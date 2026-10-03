"""
Sandboxed Code Runner and Problem Repository for the Interactive Live Coding Sandbox.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

from app.schemas.sandbox import (
    CodingProblem,
    CodingProblemSummary,
    ExampleCase,
    GradeCodeRequest,
    GradeCodeResponse,
    RunCodeRequest,
    RunCodeResponse,
    SupportedLanguage,
    TestCase,
    TestResult,
)
from app.services.llm import LLMProviderError, LLMRole, Message, Role, get_provider


# Execution timeout in seconds
EXECUTION_TIMEOUT_SECONDS = 4.0

# Curated catalog of coding challenges
CODING_PROBLEMS: list[CodingProblem] = [
CodingProblem(
        id="two-sum",
        title="Two Sum",
        domain="Data Structures & Algorithms",
        difficulty="junior",
        tags=["Array", "Hash Table", "Two Pointers"],
        description="""Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.

You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.""",
        constraints=[
            "2 <= nums.length <= 10^4",
            "-10^9 <= nums[i] <= 10^9",
            "-10^9 <= target <= 10^9",
            "Only one valid answer exists.",
        ],
        examples=[
            ExampleCase(
                input="nums = [2,7,11,15], target = 9",
                output="[0,1]",
                explanation="Because nums[0] + nums[1] == 9, we return [0, 1].",
            ),
            ExampleCase(
                input="nums = [3,2,4], target = 6",
                output="[1,2]",
                explanation="Because nums[1] + nums[2] == 6, we return [1, 2].",
            ),
        ],
        entry_function="two_sum",
        starter_code={
            "python": """def two_sum(nums: list[int], target: int) -> list[int]:
    # Your implementation here
    pass
""",
            "javascript": """function twoSum(nums, target) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data="[2, 7, 11, 15], 9", expected_output="[0, 1]"),
            TestCase(id=2, input_data="[3, 2, 4], 6", expected_output="[1, 2]"),
            TestCase(id=3, input_data="[3, 3], 6", expected_output="[0, 1]"),
            TestCase(id=4, input_data="[-1, -2, -3, -4, -5], -8", expected_output="[2, 4]"),
        ],
    ),
    CodingProblem(
        id="valid-parentheses",
        title="Valid Parentheses",
        domain="Data Structures & Algorithms",
        difficulty="junior",
        tags=["Stack", "String"],
        description="""Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.""",
        constraints=[
            "1 <= s.length <= 10^4",
            "s consists of parentheses only '()[]{}'.",
        ],
        examples=[
            ExampleCase(input='s = "()"', output="true"),
            ExampleCase(input='s = "()[]{}"', output="true"),
            ExampleCase(input='s = "(]"', output="false"),
        ],
        entry_function="is_valid",
        starter_code={
            "python": """def is_valid(s: str) -> bool:
    # Your implementation here
    pass
""",
            "javascript": """function isValid(s) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data='"()"', expected_output="True"),
            TestCase(id=2, input_data='"()[]{}"', expected_output="True"),
            TestCase(id=3, input_data='"(]"', expected_output="False"),
            TestCase(id=4, input_data='"{[]}"', expected_output="True"),
            TestCase(id=5, input_data='"([)]"', expected_output="False"),
        ],
    ),
    CodingProblem(
        id="longest-substring-without-repeating",
        title="Longest Substring Without Repeating Characters",
        domain="Data Structures & Algorithms",
        difficulty="mid",
        tags=["String", "Sliding Window", "Hash Table"],
        description="""Given a string `s`, find the length of the longest substring without duplicate characters.""",
        constraints=[
            "0 <= s.length <= 5 * 10^4",
            "s consists of English letters, digits, symbols and spaces.",
        ],
        examples=[
            ExampleCase(input='s = "abcabcbb"', output="3", explanation='The answer is "abc", with the length of 3.'),
            ExampleCase(input='s = "bbbbb"', output="1", explanation='The answer is "b", with the length of 1.'),
            ExampleCase(input='s = "pwwkew"', output="3", explanation='The answer is "wke", with the length of 3.'),
        ],
        entry_function="length_of_longest_substring",
        starter_code={
            "python": """def length_of_longest_substring(s: str) -> int:
    # Your implementation here
    pass
""",
            "javascript": """function lengthOfLongestSubstring(s) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data='"abcabcbb"', expected_output="3"),
            TestCase(id=2, input_data='"bbbbb"', expected_output="1"),
            TestCase(id=3, input_data='"pwwkew"', expected_output="3"),
            TestCase(id=4, input_data='""', expected_output="0"),
            TestCase(id=5, input_data='"dvdf"', expected_output="3"),
        ],
    ),
    CodingProblem(
        id="group-anagrams",
        title="Group Anagrams",
        domain="Data Structures & Algorithms",
        difficulty="mid",
        tags=["Array", "Hash Table", "String", "Sorting"],
        description="""Given an array of strings `strs`, group the anagrams together. You can return the answer in any order.

An Anagram is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.""",
        constraints=[
            "1 <= strs.length <= 10^4",
            "0 <= strs[i].length <= 100",
            "strs[i] consists of lowercase English letters.",
        ],
        examples=[
            ExampleCase(
                input='strs = ["eat","tea","tan","ate","nat","bat"]',
                output='[["bat"],["nat","tan"],["ate","eat","tea"]]',
            ),
            ExampleCase(input='strs = [""]', output='[[""]]'),
            ExampleCase(input='strs = ["a"]', output='[["a"]]'),
        ],
        entry_function="group_anagrams",
        starter_code={
            "python": """def group_anagrams(strs: list[str]) -> list[list[str]]:
    # Your implementation here
    pass
""",
            "javascript": """function groupAnagrams(strs) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data='["eat", "tea", "tan", "ate", "nat", "bat"]', expected_output='[["eat", "tea", "ate"], ["tan", "nat"], ["bat"]]'),
            TestCase(id=2, input_data='[""]', expected_output='[[""]]'),
            TestCase(id=3, input_data='["a"]', expected_output='[["a"]]'),
        ],
    ),
    CodingProblem(
        id="coin-change",
        title="Coin Change (Fewest Coins)",
        domain="Data Structures & Algorithms",
        difficulty="mid",
        tags=["Dynamic Programming", "Array", "Breadth-First Search"],
        description="""You are given an integer array `coins` representing coins of different denominations and an integer `amount` representing a total amount of money.

Return the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return -1.

You may assume that you have an infinite number of each kind of coin.""",
        constraints=[
            "1 <= coins.length <= 12",
            "1 <= coins[i] <= 2^31 - 1",
            "0 <= amount <= 10^4",
        ],
        examples=[
            ExampleCase(input="coins = [1,2,5], amount = 11", output="3", explanation="11 = 5 + 5 + 1"),
            ExampleCase(input="coins = [2], amount = 3", output="-1"),
            ExampleCase(input="coins = [1], amount = 0", output="0"),
        ],
        entry_function="coin_change",
        starter_code={
            "python": """def coin_change(coins: list[int], amount: int) -> int:
    # Your implementation here
    pass
""",
            "javascript": """function coinChange(coins, amount) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data="[1, 2, 5], 11", expected_output="3"),
            TestCase(id=2, input_data="[2], 3", expected_output="-1"),
            TestCase(id=3, input_data="[1], 0", expected_output="0"),
            TestCase(id=4, input_data="[1, 3, 4, 5], 7", expected_output="2"),
        ],
    ),
    CodingProblem(
        id="top-k-frequent-elements",
        title="Top K Frequent Elements",
        domain="Data Structures & Algorithms",
        difficulty="mid",
        tags=["Array", "Hash Table", "Heap", "Bucket Sort"],
        description="""Given an integer array `nums` and an integer `k`, return the `k` most frequent elements. You may return the answer in any order.""",
        constraints=[
            "1 <= nums.length <= 10^5",
            "-10^4 <= nums[i] <= 10^4",
            "k is in the range [1, the number of unique elements in the array].",
            "It is guaranteed that the answer is unique.",
        ],
        examples=[
            ExampleCase(input="nums = [1,1,1,2,2,3], k = 2", output="[1,2]"),
            ExampleCase(input="nums = [1], k = 1", output="[1]"),
        ],
        entry_function="top_k_frequent",
        starter_code={
            "python": """def top_k_frequent(nums: list[int], k: int) -> list[int]:
    # Your implementation here
    pass
""",
            "javascript": """function topKFrequent(nums, k) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data="[1, 1, 1, 2, 2, 3], 2", expected_output="[1, 2]"),
            TestCase(id=2, input_data="[1], 1", expected_output="[1]"),
            TestCase(id=3, input_data="[4, 1, -1, 2, -1, 2, 3], 2", expected_output="[-1, 2]"),
        ],
    ),
    CodingProblem(
        id="search-rotated-sorted-array",
        title="Search in Rotated Sorted Array",
        domain="Data Structures & Algorithms",
        difficulty="mid",
        tags=["Array", "Binary Search"],
        description="""There is an integer array `nums` sorted in ascending order (with distinct values).

Prior to being passed to your function, `nums` is possibly rotated at an unknown pivot index `k` (`1 <= k < nums.length`).

Given the array `nums` after the possible rotation and an integer `target`, return the index of `target` if it is in `nums`, or `-1` if it is not in `nums`.

You must write an algorithm with `O(log n)` runtime complexity.""",
        constraints=[
            "1 <= nums.length <= 5000",
            "-10^4 <= nums[i] <= 10^4",
            "All values of nums are unique.",
            "nums is an ascending array that is possibly rotated.",
            "-10^4 <= target <= 10^4",
        ],
        examples=[
            ExampleCase(input="nums = [4,5,6,7,0,1,2], target = 0", output="4"),
            ExampleCase(input="nums = [4,5,6,7,0,1,2], target = 3", output="-1"),
            ExampleCase(input="nums = [1], target = 0", output="-1"),
        ],
        entry_function="search_rotated",
        starter_code={
            "python": """def search_rotated(nums: list[int], target: int) -> int:
    # Your implementation here
    pass
""",
            "javascript": """function searchRotated(nums, target) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data="[4, 5, 6, 7, 0, 1, 2], 0", expected_output="4"),
            TestCase(id=2, input_data="[4, 5, 6, 7, 0, 1, 2], 3", expected_output="-1"),
            TestCase(id=3, input_data="[1], 0", expected_output="-1"),
            TestCase(id=4, input_data="[1, 3], 3", expected_output="1"),
        ],
    ),
    CodingProblem(
        id="merge-intervals",
        title="Merge Overlapping Intervals",
        domain="Data Structures & Algorithms",
        difficulty="mid",
        tags=["Array", "Sorting", "Intervals"],
        description="""Given an array of `intervals` where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.""",
        constraints=[
            "1 <= intervals.length <= 10^4",
            "intervals[i].length == 2",
            "0 <= start_i <= end_i <= 10^4",
        ],
        examples=[
            ExampleCase(input="intervals = [[1,3],[2,6],[8,10],[15,18]]", output="[[1,6],[8,10],[15,18]]", explanation="Since intervals [1,3] and [2,6] overlap, merge them into [1,6]."),
            ExampleCase(input="intervals = [[1,4],[4,5]]", output="[[1,5]]", explanation="Intervals [1,4] and [4,5] are considered overlapping."),
        ],
        entry_function="merge_intervals",
        starter_code={
            "python": """def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:
    # Your implementation here
    pass
""",
            "javascript": """function mergeIntervals(intervals) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data="[[1, 3], [2, 6], [8, 10], [15, 18]]", expected_output="[[1, 6], [8, 10], [15, 18]]"),
            TestCase(id=2, input_data="[[1, 4], [4, 5]]", expected_output="[[1, 5]]"),
            TestCase(id=3, input_data="[[1, 4], [0, 4]]", expected_output="[[0, 4]]"),
            TestCase(id=4, input_data="[[1, 4], [2, 3]]", expected_output="[[1, 4]]"),
        ],
    ),
    CodingProblem(
        id="trapping-rain-water",
        title="Trapping Rain Water",
        domain="Data Structures & Algorithms",
        difficulty="senior",
        tags=["Array", "Two Pointers", "Dynamic Programming", "Stack"],
        description="""Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.""",
        constraints=[
            "n == height.length",
            "1 <= n <= 2 * 10^4",
            "0 <= height[i] <= 10^5",
        ],
        examples=[
            ExampleCase(input="height = [0,1,0,2,1,0,1,3,2,1,2,1]", output="6", explanation="The elevation map can trap 6 units of rain water."),
            ExampleCase(input="height = [4,2,0,3,2,5]", output="9"),
        ],
        entry_function="trap_rain_water",
        starter_code={
            "python": """def trap_rain_water(height: list[int]) -> int:
    # Your implementation here (Two pointer O(n) time, O(1) space)
    pass
""",
            "javascript": """function trapRainWater(height) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data="[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]", expected_output="6"),
            TestCase(id=2, input_data="[4, 2, 0, 3, 2, 5]", expected_output="9"),
            TestCase(id=3, input_data="[3, 0, 2, 0, 4]", expected_output="7"),
            TestCase(id=4, input_data="[2, 0, 2]", expected_output="2"),
        ],
    ),
    CodingProblem(
        id="merge-k-sorted-lists",
        title="Merge k Sorted Arrays",
        domain="Data Structures & Algorithms",
        difficulty="senior",
        tags=["Heap", "Divide and Conquer", "Priority Queue"],
        description="""You are given an array of `k` sorted integer arrays `lists`, each sorted in ascending order.

Merge all the sorted arrays into one single sorted array and return it.

Optimize for `O(N log k)` time complexity using a min-heap or divide-and-conquer approach.""",
        constraints=[
            "k == lists.length",
            "0 <= k <= 10^4",
            "0 <= lists[i].length <= 500",
            "-10^4 <= lists[i][j] <= 10^4",
            "lists[i] is sorted in ascending order.",
            "The sum of lists[i].length will not exceed 10^4.",
        ],
        examples=[
            ExampleCase(
                input="lists = [[1,4,5],[1,3,4],[2,6]]",
                output="[1,1,2,3,4,4,5,6]",
                explanation="The arrays are merged into one sorted array: [1, 1, 2, 3, 4, 4, 5, 6].",
            ),
            ExampleCase(input="lists = []", output="[]"),
            ExampleCase(input="lists = [[]]", output="[]"),
        ],
        entry_function="merge_k_sorted",
        starter_code={
            "python": """import heapq

def merge_k_sorted(lists: list[list[int]]) -> list[int]:
    # Your implementation here (using min-heap or divide and conquer)
    pass
""",
            "javascript": """function mergeKSorted(lists) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data="[[1, 4, 5], [1, 3, 4], [2, 6]]", expected_output="[1, 1, 2, 3, 4, 4, 5, 6]"),
            TestCase(id=2, input_data="[]", expected_output="[]"),
            TestCase(id=3, input_data="[[]]", expected_output="[]"),
            TestCase(id=4, input_data="[[-2, -1, 0], [-3, 2, 4], [-1, 1]]", expected_output="[-3, -2, -1, -1, 0, 1, 2, 4]"),
        ],
    ),
    CodingProblem(
        id="lru-cache",
        title="LRU Cache Implementation",
        domain="System Design",
        difficulty="mid",
        tags=["Hash Table", "Linked List", "Design"],
        description="""Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.

Implement the `LRUCache` class:
- `LRUCache(int capacity)` Initialize the LRU cache with positive size capacity.
- `int get(int key)` Return the value of the key if the key exists, otherwise return -1.
- `void put(int key, int value)` Update the value of the key if the key exists. Otherwise, add the key-value pair to the cache. If the number of keys exceeds the capacity from this operation, evict the least recently used key.

The functions `get` and `put` must each run in O(1) average time complexity.""",
        constraints=[
            "1 <= capacity <= 3000",
            "0 <= key <= 10^4",
            "0 <= value <= 10^5",
            "At most 2 * 10^5 calls will be made to get and put.",
        ],
        examples=[
            ExampleCase(
                input="""["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"]
[[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]""",
                output="[null, null, null, 1, null, -1, null, -1, 3, 4]",
            )
        ],
        entry_function="test_lru",
        starter_code={
            "python": """class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        # Your data structures here

    def get(self, key: int) -> int:
        # Return value or -1
        return -1

    def put(self, key: int, value: int) -> None:
        # Insert or update
        pass
""",
            "javascript": """class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
    }

    get(key) {
        return -1;
    }

    put(key, value) {
    }
}
""",
        },
        test_cases=[
            TestCase(
                id=1,
                input_data='(["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"], [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]])',
                expected_output="[null, null, null, 1, null, -1, null, -1, 3, 4]",
            )
        ],
    ),
    CodingProblem(
        id="rate-limiter-token-bucket",
        title="Token Bucket Rate Limiter",
        domain="System Design",
        difficulty="senior",
        tags=["Rate Limiting", "System Design", "Concurrency"],
        description="""Implement a memory-efficient Token Bucket rate limiter algorithm used in production API gateways.

Implement `TokenBucket`:
- `__init__(capacity: int, refill_rate_per_second: float)` Initialize bucket.
- `allow_request(tokens_requested: int, current_timestamp: float) -> bool` Returns True if the bucket has enough tokens for the request, deducts the tokens, and updates state. Tokens refill continuously over time up to capacity.""",
        constraints=[
            "1 <= capacity <= 10^6",
            "0.1 <= refill_rate_per_second <= 10^6",
            "Timestamps are non-decreasing floats in seconds.",
        ],
        examples=[
            ExampleCase(
                input="""capacity = 3, refill_rate = 1.0/sec
Requests at t=0: 1 token (True), 1 token (True), 1 token (True), 1 token (False)
Request at t=1.0: 1 token (True)""",
                output="[True, True, True, False, True]",
            )
        ],
        entry_function="test_token_bucket",
        starter_code={
            "python": """class TokenBucket:
    def __init__(self, capacity: int, refill_rate_per_second: float):
        self.capacity = capacity
        self.refill_rate = refill_rate_per_second
        self.tokens = float(capacity)
        self.last_timestamp = 0.0

    def allow_request(self, tokens: int, current_timestamp: float) -> bool:
        # Refill tokens based on elapsed time and check capacity
        pass
""",
            "javascript": """class TokenBucket {
    constructor(capacity, refillRatePerSecond) {
        this.capacity = capacity;
        this.refillRate = refillRatePerSecond;
        this.tokens = capacity;
        this.lastTimestamp = 0.0;
    }

    allowRequest(tokens, currentTimestamp) {
        // Refill tokens and check capacity
        return false;
    }
}
""",
        },
        test_cases=[
            TestCase(
                id=1,
                input_data="3, 1.0, [(1, 0.0), (1, 0.0), (1, 0.0), (1, 0.0), (1, 1.0)]",
                expected_output="[True, True, True, False, True]",
            )
        ],
    ),
    CodingProblem(
        id="flatten-nested-json",
        title="Flatten Nested Dictionary / JSON",
        domain="Data Engineering",
        difficulty="junior",
        tags=["Recursion", "JSON", "Dictionary", "Data Processing"],
        description="""Given a nested dictionary `d`, flatten it into a single-level dictionary where keys are joined by a dot delimiter `.`

Empty dictionaries should be mapped to an empty dict.""",
        constraints=[
            "Dictionary depth <= 10",
            "Keys are alphanumeric strings.",
            "Values can be strings, numbers, booleans, or nested dicts.",
        ],
        examples=[
            ExampleCase(
                input='{"user": {"name": "Alice", "address": {"city": "Berlin"}}}',
                output='{"user.address.city": "Berlin", "user.name": "Alice"}',
            )
        ],
        entry_function="flatten_dictionary",
        starter_code={
            "python": """def flatten_dictionary(d: dict) -> dict:
    # Your implementation here
    pass
""",
            "javascript": """function flattenDictionary(d) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(
                id=1,
                input_data='{"user": {"name": "Alice", "address": {"city": "Berlin"}}}',
                expected_output='{"user.address.city": "Berlin", "user.name": "Alice"}',
            ),
            TestCase(
                id=2,
                input_data='{"a": 1, "b": {"c": 2, "d": {"e": 3}}}',
                expected_output='{"a": 1, "b.c": 2, "b.d.e": 3}',
            ),
            TestCase(
                id=3,
                input_data='{"simple": "value"}',
                expected_output='{"simple": "value"}',
            ),
        ],
    ),
    CodingProblem(
        id="sliding-event-window-counter",
        title="Sliding Event Window Counter",
        domain="Data Engineering",
        difficulty="mid",
        tags=["Sliding Window", "Queue", "Stream Processing"],
        description="""Given a list of sorted timestamp events `events` (in seconds) and a window size `window_duration`, return the maximum number of events that occurred within any contiguous time window of length `window_duration`.""",
        constraints=[
            "1 <= events.length <= 10^5",
            "events is sorted in non-decreasing order.",
            "0 <= events[i] <= 10^9",
            "1 <= window_duration <= 10^6",
        ],
        examples=[
            ExampleCase(input="events = [1, 2, 3, 7, 8, 9, 10, 15], window_duration = 3", output="4", explanation="Window [7, 10] has length 3 and contains 4 events (7, 8, 9, 10)."),
            ExampleCase(input="events = [10, 20, 30], window_duration = 5", output="1"),
        ],
        entry_function="max_events_in_window",
        starter_code={
            "python": """def max_events_in_window(events: list[int], window_duration: int) -> int:
    # Your implementation here using sliding window O(n)
    pass
""",
            "javascript": """function maxEventsInWindow(events, windowDuration) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data="[1, 2, 3, 7, 8, 9, 10, 15], 3", expected_output="4"),
            TestCase(id=2, input_data="[10, 20, 30], 5", expected_output="1"),
            TestCase(id=3, input_data="[1, 1, 1, 1, 1], 0", expected_output="5"),
            TestCase(id=4, input_data="[1, 5, 6, 7, 12, 13, 14, 15, 16], 4", expected_output="5"),
        ],
    ),
    CodingProblem(
        id="cosine-similarity",
        title="Vector Cosine Similarity",
        domain="Machine Learning",
        difficulty="junior",
        tags=["Linear Algebra", "Vector Search", "Machine Learning"],
        description="""Compute the cosine similarity between two n-dimensional vectors `vec_a` and `vec_b`.

Cosine similarity is defined as: `(A · B) / (||A|| * ||B||)`.

If the norm of either vector is zero, return `0.0`. Round the result to 4 decimal places.""",
        constraints=[
            "vec_a.length == vec_b.length",
            "1 <= vec_a.length <= 10^4",
            "-1000.0 <= vec_a[i], vec_b[i] <= 1000.0",
        ],
        examples=[
            ExampleCase(input="vec_a = [1.0, 2.0, 3.0], vec_b = [1.0, 2.0, 3.0]", output="1.0"),
            ExampleCase(input="vec_a = [1.0, 0.0], vec_b = [0.0, 1.0]", output="0.0"),
        ],
        entry_function="cosine_similarity",
        starter_code={
            "python": """import math

def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    # Your implementation here
    pass
""",
            "javascript": """function cosineSimilarity(vecA, vecB) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data="[1.0, 2.0, 3.0], [1.0, 2.0, 3.0]", expected_output="1.0"),
            TestCase(id=2, input_data="[1.0, 0.0], [0.0, 1.0]", expected_output="0.0"),
            TestCase(id=3, input_data="[1.0, 2.0, -1.0], [2.0, 4.0, -2.0]", expected_output="1.0"),
            TestCase(id=4, input_data="[0.0, 0.0], [1.0, 2.0]", expected_output="0.0"),
        ],
    ),
    CodingProblem(
        id="softmax-temperature",
        title="Softmax with Temperature Scaling",
        domain="Machine Learning",
        difficulty="mid",
        tags=["Machine Learning", "Mathematics", "Deep Learning"],
        description="""In neural text generation (LLMs), temperature scaling controls output randomness before applying the softmax function.

Given an array of logits `logits` and a positive float `temperature`:
1. Scale the logits: `z_i = logits_i / temperature`
2. Compute numerically stable softmax (subtract `max(z)` to prevent overflow)
3. Return the probability distribution array rounded to 4 decimal places.""",
        constraints=[
            "1 <= logits.length <= 1000",
            "temperature > 0.0",
            "-1000.0 <= logits[i] <= 1000.0",
        ],
        examples=[
            ExampleCase(
                input="logits = [2.0, 1.0, 0.1], temperature = 1.0",
                output="[0.659, 0.2424, 0.0986]",
            ),
            ExampleCase(
                input="logits = [1.0, 1.0], temperature = 0.5",
                output="[0.5, 0.5]",
            ),
        ],
        entry_function="softmax_temperature",
        starter_code={
            "python": """import math

def softmax_temperature(logits: list[float], temperature: float = 1.0) -> list[float]:
    # Implement numerically stable softmax with temperature scaling
    pass
""",
            "javascript": """function softmaxTemperature(logits, temperature = 1.0) {
    // Implementation
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data="[2.0, 1.0, 0.1], 1.0", expected_output="[0.659, 0.2424, 0.0986]"),
            TestCase(id=2, input_data="[1.0, 1.0], 0.5", expected_output="[0.5, 0.5]"),
            TestCase(id=3, input_data="[10.0, 0.0], 1.0", expected_output="[0.9999, 0.0001]"),
        ],
    ),
    CodingProblem(
        id="cross-entropy-loss",
        title="Categorical Cross-Entropy Loss",
        domain="Machine Learning",
        difficulty="mid",
        tags=["Deep Learning", "Mathematics", "Loss Functions"],
        description="""Compute the categorical cross-entropy loss between predicted probabilities `y_pred` (array of floats summing to 1) and true class label index `y_true` (int).

Loss formula: `L = -log(y_pred[y_true] + 1e-15)`

Return the loss float rounded to 4 decimal places.""",
        constraints=[
            "y_pred.length >= 2",
            "0 <= y_true < y_pred.length",
            "sum(y_pred) == 1.0",
        ],
        examples=[
            ExampleCase(input="y_pred = [0.7, 0.2, 0.1], y_true = 0", output="0.3567", explanation="-log(0.7) = 0.3567"),
            ExampleCase(input="y_pred = [0.1, 0.8, 0.1], y_true = 1", output="0.2231", explanation="-log(0.8) = 0.2231"),
        ],
        entry_function="cross_entropy_loss",
        starter_code={
            "python": """import math

def cross_entropy_loss(y_pred: list[float], y_true: int) -> float:
    # Your implementation here
    pass
""",
            "javascript": """function crossEntropyLoss(yPred, yTrue) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data="[0.7, 0.2, 0.1], 0", expected_output="0.3567"),
            TestCase(id=2, input_data="[0.1, 0.8, 0.1], 1", expected_output="0.2231"),
            TestCase(id=3, input_data="[0.5, 0.5], 1", expected_output="0.6931"),
        ],
    ),
    CodingProblem(
        id="retry-exponential-backoff",
        title="Compute Exponential Backoff Delays",
        domain="Backend & Reliability",
        difficulty="junior",
        tags=["Backend", "Reliability", "Networking"],
        description="""Given an initial delay `base_delay_ms` in milliseconds, a float `backoff_factor`, a maximum delay ceiling `max_delay_ms`, and `max_retries`, calculate the sequence of retry delays in milliseconds (capped at `max_delay_ms`).

Formula for attempt `i` (0-indexed): `min(max_delay_ms, int(base_delay_ms * (backoff_factor ** i)))`""",
        constraints=[
            "1 <= base_delay_ms <= 10^5",
            "1.0 <= backoff_factor <= 10.0",
            "base_delay_ms <= max_delay_ms <= 10^7",
            "1 <= max_retries <= 20",
        ],
        examples=[
            ExampleCase(input="base_delay_ms = 100, backoff_factor = 2.0, max_delay_ms = 1000, max_retries = 5", output="[100, 200, 400, 800, 1000]"),
            ExampleCase(input="base_delay_ms = 50, backoff_factor = 3.0, max_delay_ms = 500, max_retries = 4", output="[50, 150, 450, 500]"),
        ],
        entry_function="compute_backoff_delays",
        starter_code={
            "python": """def compute_backoff_delays(base_delay_ms: int, backoff_factor: float, max_delay_ms: int, max_retries: int) -> list[int]:
    # Your implementation here
    pass
""",
            "javascript": """function computeBackoffDelays(baseDelayMs, backoffFactor, maxDelayMs, maxRetries) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data="100, 2.0, 1000, 5", expected_output="[100, 200, 400, 800, 1000]"),
            TestCase(id=2, input_data="50, 3.0, 500, 4", expected_output="[50, 150, 450, 500]"),
            TestCase(id=3, input_data="200, 2.0, 2000, 1", expected_output="[200]"),
        ],
    ),

    CodingProblem(
        id="parse-query-string",
        title="URL Query String Parser",
        domain="Backend & Reliability",
        difficulty="junior",
        tags=["Backend", "Parsing", "Web", "String"],
        description="""Write a parser function `parse_query_string(query: str) -> dict[str, str | list[str]]` that parses a URL query parameter string.

Requirements:
1. Split parameters by `&` and key-value by `=`. Ignore empty pairs.
2. If a key appears multiple times, aggregate values into a list of strings.
3. If a key appears once, store as a single string.
4. If a key has no value (e.g., `key` or `key=`), store empty string \"\".
5. Return an empty dict for empty inputs.""",
        constraints=[
            "0 <= query.length <= 10^4",
            "Valid URI characters.",
        ],
        examples=[
            ExampleCase(input='query = "page=1&limit=20&sort=desc"', output='{"limit": "20", "page": "1", "sort": "desc"}'),
            ExampleCase(input='query = "tag=python&tag=backend&tag=fastapi"', output='{"tag": ["python", "backend", "fastapi"]}'),
        ],
        entry_function="parse_query_string",
        starter_code={
            "python": """def parse_query_string(query: str) -> dict:
    # Your implementation here
    pass
""",
            "javascript": """function parseQueryString(query) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data='"page=1&limit=20&sort=desc"', expected_output='{"limit": "20", "page": "1", "sort": "desc"}'),
            TestCase(id=2, input_data='"tag=python&tag=backend&tag=fastapi"', expected_output='{"tag": ["python", "backend", "fastapi"]}'),
            TestCase(id=3, input_data='""', expected_output='{}'),
            TestCase(id=4, input_data='"flag&status="', expected_output='{"flag": "", "status": ""}'),
        ],
    ),
    CodingProblem(
        id="matrix-transpose-and-multiply",
        title="Matrix Transpose",
        domain="Machine Learning",
        difficulty="junior",
        tags=["Linear Algebra", "Matrix", "Machine Learning"],
        description="""Given a 2D matrix `matrix` (list of lists of numbers) of shape `(M, N)`:
Compute and return the matrix transpose `M^T` of shape `(N, M)`.

Each row in the output must correspond to the respective column of the input.""",
        constraints=[
            "1 <= M, N <= 500",
            "-10^4 <= matrix[i][j] <= 10^4",
            "All rows have equal length.",
        ],
        examples=[
            ExampleCase(input="matrix = [[1, 2, 3], [4, 5, 6]]", output="[[1, 4], [2, 5], [3, 6]]"),
            ExampleCase(input="matrix = [[1]]", output="[[1]]"),
        ],
        entry_function="transpose_matrix",
        starter_code={
            "python": """def transpose_matrix(matrix: list[list[float]]) -> list[list[float]]:
    # Compute the transpose of the matrix
    pass
""",
            "javascript": """function transposeMatrix(matrix) {
    // Your implementation here
}
""",
        },
        test_cases=[
            TestCase(id=1, input_data="[[1, 2, 3], [4, 5, 6]]", expected_output="[[1, 4], [2, 5], [3, 6]]"),
            TestCase(id=2, input_data="[[1]]", expected_output="[[1]]"),
            TestCase(id=3, input_data="[[1, 2], [3, 4], [5, 6]]", expected_output="[[1, 3, 5], [2, 4, 6]]"),
        ],
    ),

]


def list_coding_problems(
    domain: str | None = None,
    difficulty: str | None = None,
) -> list[CodingProblemSummary]:
    """Returns list of available coding problem summaries with optional filters."""
    results: list[CodingProblemSummary] = []
    for p in CODING_PROBLEMS:
        if domain and domain.lower() != "all" and p.domain.lower() != domain.lower():
            continue
        if difficulty and difficulty.lower() != "all" and p.difficulty.lower() != difficulty.lower():
            continue
        results.append(
            CodingProblemSummary(
                id=p.id,
                title=p.title,
                domain=p.domain,
                difficulty=p.difficulty,
                tags=p.tags,
                description_snippet=p.description.split("\n")[0][:120],
                test_cases_count=len(p.test_cases),
            )
        )
    return results


def get_coding_problem(problem_id: str) -> CodingProblem | None:
    """Returns a specific coding problem by its ID."""
    for p in CODING_PROBLEMS:
        if p.id.lower() == problem_id.lower():
            return p
    return None


def _build_python_test_harness(
    user_code: str,
    test_cases: list[TestCase],
    entry_function: str | None,
    custom_input: str | None = None,
) -> str:
    """
    Builds a secure self-contained Python execution script that runs the candidate's
    code against each test case and serializes results to stdout as JSON.
    """
    tc_json = repr(json.dumps([tc.model_dump() for tc in test_cases]))
    custom_in_json = repr(json.dumps(custom_input))
    entry_fn_json = repr(json.dumps(entry_function))

    template = '''
import sys, json, time, math

# Candidate Code
__USER_CODE__

test_cases = json.loads(__TEST_CASES_JSON__)
custom_input = json.loads(__CUSTOM_INPUT_JSON__)
entry_fn_name = json.loads(__ENTRY_FN_JSON__)



def normalize(val):
    if val is None:
        return "null"
    if isinstance(val, bool):
        return "True" if val else "False"
    if isinstance(val, (list, tuple)):
        return json.dumps(list(val))
    if isinstance(val, dict):
        return json.dumps(val, sort_keys=True)
    if isinstance(val, float):
        return str(round(val, 4))
    return str(val)

def compare_outputs(actual, expected_str):
    act_norm = normalize(actual).strip().lower()
    exp_norm = expected_str.strip().lower()
    if act_norm == exp_norm:
        return True
    try:
        j_act = json.loads(normalize(actual))
        j_exp = json.loads(expected_str)
        if isinstance(j_act, list) and isinstance(j_exp, list):
            if len(j_act) == len(j_exp):
                return all(math.isclose(float(a), float(b), rel_tol=1e-3, abs_tol=1e-3) if isinstance(a, (int, float)) and isinstance(b, (int, float)) else a == b for a, b in zip(j_act, j_exp))
        return j_act == j_exp
    except Exception:
        pass
    return False

results = []

# Special test wrapper for LRUCache
if "LRUCache" in globals() and entry_fn_name == "test_lru":
    for tc in test_cases:
        t_start = time.perf_counter()
        try:
            ops, args = eval("(" + tc['input_data'] + ")")
            cache = None
            out = []
            for op, arg in zip(ops, args):
                if op == "LRUCache":
                    cache = LRUCache(arg[0])
                    out.append(None)
                elif op == "put":
                    cache.put(arg[0], arg[1])
                    out.append(None)
                elif op == "get":
                    res = cache.get(arg[0])
                    out.append(res)
            t_dur = (time.perf_counter() - t_start) * 1000
            passed = compare_outputs(out, tc['expected_output'])
            results.append({
                "test_case_id": tc['id'],
                "passed": passed,
                "input_data": tc['input_data'],
                "expected_output": tc['expected_output'],
                "actual_output": normalize(out),
                "execution_time_ms": round(t_dur, 2),
                "error": None
            })
        except Exception as exc:
            t_dur = (time.perf_counter() - t_start) * 1000
            results.append({
                "test_case_id": tc['id'],
                "passed": False,
                "input_data": tc['input_data'],
                "expected_output": tc['expected_output'],
                "actual_output": None,
                "execution_time_ms": round(t_dur, 2),
                "error": str(exc)
            })

# Special test wrapper for TokenBucket
elif "TokenBucket" in globals() and entry_fn_name == "test_token_bucket":
    for tc in test_cases:
        t_start = time.perf_counter()
        try:
            cap, rate, reqs = eval("(" + tc['input_data'] + ")")
            bucket = TokenBucket(cap, rate)
            out = []
            for tokens, timestamp in reqs:
                res = bucket.allow_request(tokens, timestamp)
                out.append(res)
            t_dur = (time.perf_counter() - t_start) * 1000
            passed = compare_outputs(out, tc['expected_output'])
            results.append({
                "test_case_id": tc['id'],
                "passed": passed,
                "input_data": tc['input_data'],
                "expected_output": tc['expected_output'],
                "actual_output": normalize(out),
                "execution_time_ms": round(t_dur, 2),
                "error": None
            })
        except Exception as exc:
            t_dur = (time.perf_counter() - t_start) * 1000
            results.append({
                "test_case_id": tc['id'],
                "passed": False,
                "input_data": tc['input_data'],
                "expected_output": tc['expected_output'],
                "actual_output": None,
                "execution_time_ms": round(t_dur, 2),
                "error": str(exc)
            })

# Standard function invocation
elif entry_fn_name and entry_fn_name in globals() and callable(globals()[entry_fn_name]):
    fn = globals()[entry_fn_name]
    for tc in test_cases:
        t_start = time.perf_counter()
        try:
            raw_input = tc['input_data']
            args = eval("(" + raw_input + ")")
            if not isinstance(args, tuple):
                args = (args,)
            actual = fn(*args)
            t_dur = (time.perf_counter() - t_start) * 1000
            passed = compare_outputs(actual, tc['expected_output'])
            results.append({
                "test_case_id": tc['id'],
                "passed": passed,
                "input_data": tc['input_data'],
                "expected_output": tc['expected_output'],
                "actual_output": normalize(actual),
                "execution_time_ms": round(t_dur, 2),
                "error": None
            })
        except Exception as exc:
            t_dur = (time.perf_counter() - t_start) * 1000
            results.append({
                "test_case_id": tc['id'],
                "passed": False,
                "input_data": tc['input_data'],
                "expected_output": tc['expected_output'],
                "actual_output": None,
                "execution_time_ms": round(t_dur, 2),
                "error": str(exc)
            })

print("__RP_RESULT_DELIMITER__")
print(json.dumps({"results": results}))
'''

    return (
        template
        .replace("__USER_CODE__", user_code)
        .replace("__TEST_CASES_JSON__", tc_json)
        .replace("__CUSTOM_INPUT_JSON__", custom_in_json)
        .replace("__ENTRY_FN_JSON__", entry_fn_json)
    )



def run_code_in_sandbox(req: RunCodeRequest) -> RunCodeResponse:
    """
    Executes candidate code in an isolated subprocess sandbox.
    """
    start_total_t = time.perf_counter()

    if req.language == SupportedLanguage.PYTHON:
        script = _build_python_test_harness(
            user_code=req.code,
            test_cases=req.test_cases,
            entry_function=req.entry_function,
            custom_input=req.custom_input,
        )

        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(script)
            temp_path = f.name

        try:
            # Run using backend venv python interpreter
            proc = subprocess.run(
                [sys.executable, temp_path],
                capture_output=True,
                text=True,
                timeout=EXECUTION_TIMEOUT_SECONDS,
            )
            total_duration_ms = (time.perf_counter() - start_total_t) * 1000

            stdout_full = proc.stdout or ""
            stderr = proc.stderr or ""

            if "__RP_RESULT_DELIMITER__" in stdout_full:
                user_stdout, result_json = stdout_full.split("__RP_RESULT_DELIMITER__", 1)
                user_stdout = user_stdout.strip()
                try:
                    payload = json.loads(result_json.strip())
                    raw_results = payload.get("results", [])
                    results = [TestResult(**r) for r in raw_results]
                    passed_count = sum(1 for r in results if r.passed)
                    all_passed = (passed_count == len(results)) if results else True

                    return RunCodeResponse(
                        success=proc.returncode == 0,
                        stdout=user_stdout,
                        stderr=stderr,
                        results=results,
                        all_passed=all_passed,
                        passed_count=passed_count,
                        total_count=len(results),
                        total_execution_time_ms=round(total_duration_ms, 2),
                        error=None if proc.returncode == 0 else f"Process exited with code {proc.returncode}",
                    )
                except Exception as exc:
                    return RunCodeResponse(
                        success=False,
                        stdout=user_stdout,
                        stderr=stderr,
                        results=[],
                        all_passed=False,
                        total_execution_time_ms=round(total_duration_ms, 2),
                        error=f"Failed to parse test outputs: {exc}",
                    )
            else:
                return RunCodeResponse(
                    success=proc.returncode == 0,
                    stdout=stdout_full,
                    stderr=stderr,
                    results=[],
                    all_passed=False,
                    total_execution_time_ms=round(total_duration_ms, 2),
                    error=stderr if proc.returncode != 0 else None,
                )

        except subprocess.TimeoutExpired:
            total_duration_ms = (time.perf_counter() - start_total_t) * 1000
            return RunCodeResponse(
                success=False,
                stdout="",
                stderr="Execution Timed Out (Limit: 4.0s). Possible infinite loop or high time complexity.",
                results=[],
                all_passed=False,
                total_execution_time_ms=round(total_duration_ms, 2),
                error="TimeLimitExceeded: Your code took too long to execute.",
            )
        except Exception as exc:
            total_duration_ms = (time.perf_counter() - start_total_t) * 1000
            return RunCodeResponse(
                success=False,
                stdout="",
                stderr=str(exc),
                results=[],
                all_passed=False,
                total_execution_time_ms=round(total_duration_ms, 2),
                error=str(exc),
            )
        finally:
            try:
                os.remove(temp_path)
            except Exception:
                pass

    # JavaScript execution (Node.js fallback or browser client-side execution)
    return RunCodeResponse(
        success=False,
        stdout="",
        stderr="JavaScript runner operates natively in the browser client sandbox.",
        results=[],
        all_passed=False,
        error="Language currently executed via client-side runner.",
    )


def _build_offline_code_assessment(req: GradeCodeRequest) -> GradeCodeResponse:
    """Generates an offline fallback assessment when the LLM provider is unavailable."""
    passed_count = sum(1 for r in req.test_results if r.passed)
    total_count = len(req.test_results)
    pass_rate = (passed_count / total_count) if total_count > 0 else 0.0

    raw_score = int(round(pass_rate * 8))
    # Check basic code patterns
    code_lower = req.code.lower()
    has_comments = "#" in req.code or "//" in req.code
    has_typing = "->" in req.code or ":" in req.code
    if has_comments:
        raw_score = min(10, raw_score + 1)

    # Estimate complexity heuristically
    nested_loops = code_lower.count("for ") + code_lower.count("while ")
    if nested_loops >= 2:
        time_comp = "O(n²)"
    elif nested_loops == 1:
        time_comp = "O(n)"
    else:
        time_comp = "O(1) / O(log n)"

    space_comp = "O(n)" if ("dict" in code_lower or "{" in code_lower or "set" in code_lower or "list" in code_lower) else "O(1)"

    improvements = []
    if pass_rate < 1.0:
        improvements.append("Resolve remaining failing test cases and handle edge cases (empty inputs, negative bounds).")
    if nested_loops >= 2:
        improvements.append("Consider optimizing time complexity by utilizing hash tables or two-pointer techniques.")
    improvements.append("Add docstrings and variable type annotations for clean production readiness.")

    detailed_md = f"""### Code Review & Assessment: {req.problem_title}

**Score:** {raw_score}/10  
**Test Cases:** {passed_count}/{total_count} Passed

#### 1. Algorithmic Complexity
- **Time Complexity:** `{time_comp}`
- **Space Complexity:** `{space_comp}`

#### 2. Correctness & Test Verification
{f'All {total_count} test cases passed successfully.' if pass_rate == 1.0 else f'{passed_count} of {total_count} test cases passed. Review failing inputs.'}

#### 3. Edge Case Coverage
Ensure behavior is validated under boundary conditions such as empty inputs, single element arrays, large numbers, and duplicated elements.

#### 4. Recommended Next Steps
{chr(10).join(f'- {item}' for item in improvements)}
"""

    return GradeCodeResponse(
        score=raw_score,
        time_complexity=time_comp,
        space_complexity=space_comp,
        correctness_assessment=f"{passed_count}/{total_count} test cases verified." if total_count > 0 else "Code analyzed.",
        code_quality_feedback="Code structure is clear. Ensure proper naming conventions and modularity.",
        edge_cases_feedback="Verify zero/null values, single-item collections, and extreme upper constraints.",
        recommended_improvements=improvements,
        detailed_markdown=detailed_md.strip(),
    )


async def grade_code_submission(req: GradeCodeRequest) -> GradeCodeResponse:
    """
    Evaluates candidate code submission using Gemini AI code assessment,
    falling back to deterministic analysis if LLM is unavailable.
    """
    total_tests = len(req.test_results)
    passed_tests = sum(1 for r in req.test_results if r.passed)

    test_summary = f"Passed {passed_tests}/{total_tests} test cases."
    test_details = "\n".join(
        f"- Test {r.test_case_id}: {'PASSED' if r.passed else 'FAILED'} | Input: `{r.input_data}` | Expected: `{r.expected_output}` | Actual: `{r.actual_output}` | Error: `{r.error}`"
        for r in req.test_results
    )

    system_prompt = (
        "You are an expert senior software engineering interviewer and staff engineer conducting a technical coding assessment. "
        "Evaluate the candidate's code submission rigorously based on correctness, time/space complexity (Big-O), code cleanliness, and edge case resilience.\n\n"
        "Return a JSON response adhering EXACTLY to this schema:\n"
        "{\n"
        '  "score": <integer from 0 to 10>,\n'
        '  "time_complexity": "<e.g. O(n), O(n log n), O(n^2)>",\n'
        '  "space_complexity": "<e.g. O(1), O(n)>",\n'
        '  "correctness_assessment": "<1-2 concise sentences on functional correctness>",\n'
        '  "code_quality_feedback": "<1-2 sentences on naming, idiomatic syntax, clean code>",\n'
        '  "edge_cases_feedback": "<1-2 sentences on boundary checks, empty arrays, extremes>",\n'
        '  "recommended_improvements": ["<bullet 1>", "<bullet 2>", "<bullet 3>"],\n'
        '  "detailed_markdown": "<Comprehensive markdown feedback with sections: ## Solution Architecture, ## Big-O Analysis, ## Edge Cases & Production Readiness, ## Code Polish>"\n'
        "}\n"
        "Do NOT wrap in markdown fences other than raw JSON."
    )

    user_prompt = f"""Problem: {req.problem_title}
Language: {req.language.value}
Candidate Role Target: {req.role or 'Software Engineer'} ({req.experience_level or 'Mid-Level'})

Candidate Code:
```{req.language.value}
{req.code}
```

Test Results:
{test_summary}
{test_details}
"""

    try:
        provider = get_provider(LLMRole.GRADER)
        response = await provider.generate(
            messages=[
                Message(role=Role.SYSTEM, content=system_prompt),
                Message(role=Role.USER, content=user_prompt),
            ],
            temperature=0.2,
            max_tokens=1500,
        )

        content = response.content.strip()
        # Clean any accidental code block wraps
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        data = json.loads(content)
        return GradeCodeResponse(
            score=int(data.get("score", 7)),
            time_complexity=str(data.get("time_complexity", "O(n)")),
            space_complexity=str(data.get("space_complexity", "O(1)")),
            correctness_assessment=str(data.get("correctness_assessment", test_summary)),
            code_quality_feedback=str(data.get("code_quality_feedback", "Well written solution.")),
            edge_cases_feedback=str(data.get("edge_cases_feedback", "Standard cases handled.")),
            recommended_improvements=list(data.get("recommended_improvements", [])),
            detailed_markdown=str(data.get("detailed_markdown", "")),
        )
    except Exception:
        # Fallback to deterministic assessment
        return _build_offline_code_assessment(req)

