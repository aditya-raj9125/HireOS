/**
 * TranscriptNormalizer — Fixes common STT misrecognitions and normalizes
 * technical terms in transcripts. Pure text transformation, no LLM call.
 */

type Language = 'en' | 'hi'

// Common English technical term corrections
const EN_CORRECTIONS: [RegExp, string][] = [
  // Complexity notation
  [/\bbig oh? of n\b/gi, 'O(n)'],
  [/\bbig oh? of n (squared|square)\b/gi, 'O(n²)'],
  [/\bbig oh? of n log n\b/gi, 'O(n log n)'],
  [/\bbig oh? of log n\b/gi, 'O(log n)'],
  [/\bbig oh? of one\b/gi, 'O(1)'],
  [/\bbig oh? of (n|and) (cubed|cube)\b/gi, 'O(n³)'],
  [/\bo of n\b/gi, 'O(n)'],
  [/\bo of one\b/gi, 'O(1)'],

  // Algorithm names
  [/\bdijkra\b/gi, 'Dijkstra'],
  [/\bdijkstra's\b/gi, "Dijkstra's"],
  [/\bbell?man ford\b/gi, 'Bellman-Ford'],
  [/\bfloyd war?shall?\b/gi, 'Floyd-Warshall'],
  [/\bcruskal\b/gi, 'Kruskal'],
  [/\bprim['']?s\b/gi, "Prim's"],
  [/\bbinary search tree\b/gi, 'binary search tree'],
  [/\bred ?black tree\b/gi, 'red-black tree'],
  [/\bmerge sort\b/gi, 'merge sort'],
  [/\bquick sort\b/gi, 'quicksort'],
  [/\bheap sort\b/gi, 'heapsort'],
  [/\bbubble sort\b/gi, 'bubble sort'],

  // Technology names
  [/\bredis\b/gi, 'Redis'],
  [/\bmongo d ?b\b/gi, 'MongoDB'],
  [/\bpost ?gress?\b/gi, 'Postgres'],
  [/\bpost ?gress? q l\b/gi, 'PostgreSQL'],
  [/\bmy ?sequel\b/gi, 'MySQL'],
  [/\bkubernetes\b/gi, 'Kubernetes'],
  [/\bdocker\b/gi, 'Docker'],
  [/\bkafka\b/gi, 'Kafka'],
  [/\b(rabbit|rabbet) ?m ?q\b/gi, 'RabbitMQ'],
  [/\breact\b/gi, 'React'],
  [/\bnext ?j ?s\b/gi, 'Next.js'],
  [/\bnode ?j ?s\b/gi, 'Node.js'],
  [/\btypescript\b/gi, 'TypeScript'],
  [/\bjavascript\b/gi, 'JavaScript'],
  [/\bpython\b/gi, 'Python'],
  [/\bjava\b/g, 'Java'], // case-sensitive — only fix lowercase

  // Data structures
  [/\bhash ?map\b/gi, 'HashMap'],
  [/\bhash ?table\b/gi, 'hash table'],
  [/\blinked ?list\b/gi, 'linked list'],
  [/\barray ?list\b/gi, 'ArrayList'],
  [/\bb ?tree\b/gi, 'B-tree'],
  [/\btrie\b/gi, 'trie'],

  // Concepts
  [/\brest a ?p ?i\b/gi, 'REST API'],
  [/\bg ?r ?p ?c\b/gi, 'gRPC'],
  [/\bgraph ?q ?l\b/gi, 'GraphQL'],
  [/\bc ?i ?c ?d\b/gi, 'CI/CD'],
  [/\ba ?w ?s\b/gi, 'AWS'],
  [/\bg ?c ?p\b/gi, 'GCP'],
  [/\bazure\b/gi, 'Azure'],
  [/\bsolid principles\b/gi, 'SOLID principles'],
  [/\bdry principle\b/gi, 'DRY principle'],
  [/\bacid\b/g, 'ACID'],
  [/\bcap theorem\b/gi, 'CAP theorem'],
]

// Hindi technical term transliterations (Devanagari → English canonical)
const HI_TRANSLITERATIONS: [RegExp, string][] = [
  [/\bऐरे\b/g, 'array'],
  [/\bलिंक्ड लिस्ट\b/g, 'linked list'],
  [/\bहैश मैप\b/g, 'HashMap'],
  [/\bट्री\b/g, 'tree'],
  [/\bग्राफ\b/g, 'graph'],
  [/\bस्टैक\b/g, 'stack'],
  [/\bक्यू\b/g, 'queue'],
  [/\bसॉर्ट\b/g, 'sort'],
  [/\bसर्च\b/g, 'search'],
  [/\bरिकर्शन\b/g, 'recursion'],
  [/\bडायनामिक प्रोग्रामिंग\b/g, 'dynamic programming'],
  [/\bटाइम कंप्लेक्सिटी\b/g, 'time complexity'],
  [/\bस्पेस कंप्लेक्सिटी\b/g, 'space complexity'],
  [/\bडेटाबेस\b/g, 'database'],
  [/\bसर्वर\b/g, 'server'],
  [/\bक्लाइंट\b/g, 'client'],
  [/\bएपीआई\b/g, 'API'],
  [/\bफंक्शन\b/g, 'function'],
  [/\bवेरिएबल\b/g, 'variable'],
  [/\bक्लास\b/g, 'class'],
  [/\bइंटरफेस\b/g, 'interface'],
  [/\bमेथड\b/g, 'method'],
  [/\bऑब्जेक्ट\b/g, 'object'],
  [/\bइनहेरिटेंस\b/g, 'inheritance'],
  [/\bपॉलीमॉर्फिज्म\b/g, 'polymorphism'],
  [/\bएनकैप्सुलेशन\b/g, 'encapsulation'],
  [/\bथ्रेड\b/g, 'thread'],
  [/\bप्रोसेस\b/g, 'process'],
  [/\bमेमोरी\b/g, 'memory'],
  [/\bकैश\b/g, 'cache'],
  [/\bलोड बैलेंसर\b/g, 'load balancer'],
]

// Common filler words to strip (only when transcript is long enough)
const EN_FILLERS = /\b(um+|uh+|like,?|you know,?|basically,?|actually,?|so,?|right,?)\b/gi
const HI_FILLERS = /\b(मतलब|बोलो|अच्छा|हाँ|ना|तो|वो|ये)\b/g

const MIN_LENGTH_FOR_FILLER_STRIP = 200

export class TranscriptNormalizer {
  /**
   * Normalize a transcript string. Fixes common misrecognitions
   * and strips fillers from sufficiently long transcripts.
   */
  normalize(transcript: string, language: Language): string {
    if (!transcript || transcript.trim().length === 0) return transcript

    let result = transcript

    // Apply language-specific corrections
    if (language === 'en') {
      for (const [pattern, replacement] of EN_CORRECTIONS) {
        result = result.replace(pattern, replacement)
      }
    }

    if (language === 'hi') {
      for (const [pattern, replacement] of HI_TRANSLITERATIONS) {
        result = result.replace(pattern, replacement)
      }
      // Also apply English corrections for code-switched Hinglish
      for (const [pattern, replacement] of EN_CORRECTIONS) {
        result = result.replace(pattern, replacement)
      }
    }

    // Strip fillers only from long transcripts
    if (result.length >= MIN_LENGTH_FOR_FILLER_STRIP) {
      if (language === 'en') {
        result = result.replace(EN_FILLERS, '')
      } else if (language === 'hi') {
        result = result.replace(HI_FILLERS, '')
      }

      // Clean up double spaces left by filler removal
      result = result.replace(/ {2,}/g, ' ').trim()
    }

    return result
  }
}
