import type { GraphEdge, GraphNode, Mask, Point, SkeletonGraph } from '@/lib/types'

const NEIGHBOURS_8 = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const

export interface GraphOptions {
  /**
   * Longueur en pixels sous laquelle une arête borgne (une seule extrémité
   * libre) est considérée comme un artefact de squelettisation et supprimée.
   */
  pruneSpursBelow?: number
}

/**
 * Convertit un squelette 1 px en graphe : les sommets sont les extrémités et
 * les jonctions, les arêtes sont les chaînes de pixels entre deux sommets.
 *
 * C'est l'étape absente des générateurs existants. Eux appellent l'équivalent
 * d'un `findContours(RETR_EXTERNAL)` qui ne renvoie qu'une boucle fermée par
 * forme et jette tout l'intérieur. Ici on garde la structure complète du
 * dessin, embranchements compris.
 */
export function buildGraph(skeleton: Mask, options: GraphOptions = {}): SkeletonGraph {
  const { width, height, data } = skeleton
  const { pruneSpursBelow = 0 } = options

  const inked = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && data[y * width + x] === 1

  const xOf = (p: number): number => p % width
  const yOf = (p: number): number => (p - (p % width)) / width

  // Degré pixel par pixel : le nombre de voisins encrés.
  const pixelDegree = new Uint8Array(width * height)
  const inkedPixels: number[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (data[p] !== 1) continue
      let count = 0
      for (const [dx, dy] of NEIGHBOURS_8) {
        if (inked(x + dx, y + dy)) count++
      }
      pixelDegree[p] = count
      inkedPixels.push(p)
    }
  }

  // Un pixel de degré 2 est au milieu d'un trait. Tout le reste (extrémité,
  // jonction, pixel isolé) est un sommet. Les pixels-sommets voisins sont
  // fusionnés : une jonction en Y occupe souvent 2 ou 3 pixels.
  const nodeIdOf = new Int32Array(width * height).fill(-1)
  const nodes: GraphNode[] = []
  const nodePixels: number[][] = []

  const claimNode = (seed: number): number => {
    const id = nodes.length
    const blob: number[] = []
    const stack = [seed]
    nodeIdOf[seed] = id

    while (stack.length > 0) {
      const p = stack.pop()!
      blob.push(p)
      const x = xOf(p)
      const y = yOf(p)
      for (const [dx, dy] of NEIGHBOURS_8) {
        const nx = x + dx
        const ny = y + dy
        if (!inked(nx, ny)) continue
        const q = ny * width + nx
        if (pixelDegree[q] === 2 || nodeIdOf[q] !== -1) continue
        nodeIdOf[q] = id
        stack.push(q)
      }
    }

    let sumX = 0
    let sumY = 0
    for (const p of blob) {
      sumX += xOf(p)
      sumY += yOf(p)
    }
    nodes.push({ id, x: sumX / blob.length, y: sumY / blob.length, degree: 0 })
    nodePixels.push(blob)
    return id
  }

  /** Sommet réduit à un seul pixel, pour clore une chaîne là où elle s'arrête. */
  const forceNode = (pixel: number): number => {
    const id = nodes.length
    nodeIdOf[pixel] = id
    nodes.push({ id, x: xOf(pixel), y: yOf(pixel), degree: 0 })
    nodePixels.push([pixel])
    return id
  }

  for (const p of inkedPixels) {
    if (pixelDegree[p] === 2 || nodeIdOf[p] !== -1) continue
    claimNode(p)
  }

  const edges: GraphEdge[] = []
  const walked = new Uint8Array(width * height)
  const directLinks = new Set<string>()

  const addEdge = (a: number, b: number, points: Point[]): void => {
    let length = 0
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!
      const cur = points[i]!
      length += Math.hypot(cur.x - prev.x, cur.y - prev.y)
    }
    edges.push({ id: edges.length, a, b, points, length })
  }

  /**
   * Suit une chaîne de pixels de degré 2 depuis un sommet jusqu'au sommet
   * suivant. On privilégie toujours un pixel de chaîne non visité avant de
   * terminer sur un sommet : sans cela, une chaîne qui longe en diagonale le
   * blob dont elle sort y serait immédiatement rebouclée.
   */
  const walkChain = (fromNode: number, entry: number, exitAt: number): void => {
    const points: Point[] = [{ x: xOf(entry), y: yOf(entry) }]
    let previous = entry
    let current = exitAt

    for (;;) {
      walked[current] = 1
      points.push({ x: xOf(current), y: yOf(current) })

      const x = xOf(current)
      const y = yOf(current)
      let nextChain = -1
      let nextNode = -1

      for (const [dx, dy] of NEIGHBOURS_8) {
        const nx = x + dx
        const ny = y + dy
        if (!inked(nx, ny)) continue
        const q = ny * width + nx
        if (q === previous) continue
        if (nodeIdOf[q] !== -1) {
          if (nextNode === -1) nextNode = q
        } else if (!walked[q] && nextChain === -1) {
          nextChain = q
        }
      }

      if (nextChain !== -1) {
        previous = current
        current = nextChain
        continue
      }

      if (nextNode !== -1) {
        points.push({ x: xOf(nextNode), y: yOf(nextNode) })
        addEdge(fromNode, nodeIdOf[nextNode]!, points)
      } else {
        // Impasse : la chaîne butte sur des pixels déjà parcourus. On crée un
        // sommet là où elle s'arrête. La refermer sur son point de départ en
        // ferait une boucle géométriquement fausse, avec un segment fantôme
        // traversant tout le dessin.
        addEdge(fromNode, forceNode(current), points)
      }
      return
    }
  }

  const exploreNode = (nodeId: number): void => {
    for (const p of nodePixels[nodeId]!) {
      const x = xOf(p)
      const y = yOf(p)
      for (const [dx, dy] of NEIGHBOURS_8) {
        const nx = x + dx
        const ny = y + dy
        if (!inked(nx, ny)) continue
        const q = ny * width + nx

        const neighbourNode = nodeIdOf[q]!
        if (neighbourNode === nodeId) continue

        if (neighbourNode !== -1) {
          // Deux sommets collés : arête sans pixel intermédiaire.
          const key = p < q ? `${p}:${q}` : `${q}:${p}`
          if (directLinks.has(key)) continue
          directLinks.add(key)
          addEdge(nodeId, neighbourNode, [
            { x, y },
            { x: nx, y: ny },
          ])
          continue
        }

        if (walked[q]) continue
        walkChain(nodeId, p, q)
      }
    }
  }

  for (const node of nodes) exploreNode(node.id)

  // Boucles pures (un cercle isolé) : aucun pixel n'a un degré différent de 2,
  // donc aucun sommet n'a été créé. On en fabrique un arbitrairement.
  for (const p of inkedPixels) {
    if (nodeIdOf[p] !== -1 || walked[p]) continue
    exploreNode(claimNode(p))
  }

  const graph: SkeletonGraph = { nodes, edges }
  computeDegrees(graph)

  const pruned = pruneSpursBelow > 0 ? pruneSpurs(graph, pruneSpursBelow) : graph
  return dissolveDegreeTwoNodes(dropIsolatedNodes(dropDegenerateLoops(pruned)))
}

/**
 * Retire les micro-boucles refermées sur un même sommet. Un escalier de
 * discrétisation en produit une à chaque virage à 45 degrés ; elles ne portent
 * aucune information de dessin et empêchent de dissoudre le sommet.
 */
export function dropDegenerateLoops(graph: SkeletonGraph, minLength = 4): SkeletonGraph {
  const kept = graph.edges.filter((edge) => edge.a !== edge.b || edge.length >= minLength)
  if (kept.length === graph.edges.length) return graph
  const result: SkeletonGraph = { nodes: graph.nodes, edges: kept }
  computeDegrees(result)
  return result
}

/**
 * Fusionne les traits séparés par un sommet de degré 2.
 *
 * Un tel sommet n'est ni une extrémité ni une jonction : il vient de l'escalier
 * de discrétisation (un cercle numérique produit des dizaines de pixels à trois
 * voisins) ou d'une barbule qu'on vient de retirer. Le recoller est exact, les
 * deux chaînes de pixels se touchent, et ça évite de compter de fausses
 * jonctions puis de multiplier les séquences.
 */
export function dissolveDegreeTwoNodes(graph: SkeletonGraph): SkeletonGraph {
  let nodes = graph.nodes
  let edges = graph.edges

  for (;;) {
    computeDegrees({ nodes, edges })

    // Une boucle sur soi compte deux rattachements : sans ça, un sommet portant
    // une boucle plus un trait passerait pour un degré 2, et le fusionner
    // laisserait une arête pointant vers un sommet supprimé.
    const incident = new Map<number, number[]>()
    for (const node of nodes) incident.set(node.id, [])
    for (const edge of edges) {
      incident.get(edge.a)!.push(edge.id)
      incident.get(edge.b)!.push(edge.id)
    }

    const victim = nodes.find((node) => {
      const attached = incident.get(node.id)!
      return attached.length === 2 && attached[0] !== attached[1]
    })
    if (!victim) return reindex(nodes, edges)

    const [firstId, secondId] = incident.get(victim.id)! as [number, number]
    const first = edges.find((edge) => edge.id === firstId)!
    const second = edges.find((edge) => edge.id === secondId)!

    // On oriente la première arête pour qu'elle arrive sur le sommet, la seconde
    // pour qu'elle en repart.
    const incoming = first.b === victim.id ? first.points : [...first.points].reverse()
    const outgoing = second.a === victim.id ? second.points : [...second.points].reverse()
    const from = first.b === victim.id ? first.a : first.b
    const to = second.a === victim.id ? second.b : second.a

    const points = [...incoming]
    for (const point of outgoing) {
      const last = points[points.length - 1]!
      if (last.x === point.x && last.y === point.y) continue
      points.push(point)
    }

    let length = 0
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1]!
      const cur = points[i]!
      length += Math.hypot(cur.x - previous.x, cur.y - previous.y)
    }

    edges = [
      ...edges.filter((edge) => edge.id !== firstId && edge.id !== secondId),
      { id: Math.max(...edges.map((edge) => edge.id)) + 1, a: from, b: to, points, length },
    ]
    nodes = nodes.filter((node) => node.id !== victim.id)
  }
}

/**
 * Recalcule les degrés. Indexé par identifiant et non par position : après un
 * filtrage, les deux ne coïncident plus jusqu'au prochain `reindex`.
 */
function computeDegrees(graph: SkeletonGraph): Map<number, GraphNode> {
  const byId = new Map<number, GraphNode>()
  for (const node of graph.nodes) {
    node.degree = 0
    byId.set(node.id, node)
  }
  for (const edge of graph.edges) {
    const a = byId.get(edge.a)
    const b = byId.get(edge.b)
    if (a) a.degree++
    if (b) b.degree++
  }
  return byId
}

/**
 * Supprime les barbules : de courtes arêtes borgnes que la squelettisation
 * génère sur les traits épais ou irréguliers (les contours en dents de scie
 * d'un coloriage en produisent beaucoup). Itératif, car retirer une barbule
 * peut en révéler une autre.
 */
export function pruneSpurs(graph: SkeletonGraph, minLength: number): SkeletonGraph {
  let edges = graph.edges
  const nodes = graph.nodes

  for (;;) {
    const byId = computeDegrees({ nodes, edges })

    const doomed = new Set<number>()
    for (const edge of edges) {
      if (edge.length >= minLength) continue
      if (edge.a === edge.b) continue
      const degreeA = byId.get(edge.a)?.degree ?? 0
      const degreeB = byId.get(edge.b)?.degree ?? 0
      // Borgne : une extrémité libre, l'autre sur une jonction qui survivra.
      const spurAtA = degreeA === 1 && degreeB >= 3
      const spurAtB = degreeB === 1 && degreeA >= 3
      if (spurAtA || spurAtB) doomed.add(edge.id)
    }

    if (doomed.size === 0) return reindex(nodes, edges)
    edges = edges.filter((edge) => !doomed.has(edge.id))
  }
}

function dropIsolatedNodes(graph: SkeletonGraph): SkeletonGraph {
  const used = new Set<number>()
  for (const edge of graph.edges) {
    used.add(edge.a)
    used.add(edge.b)
  }
  if (graph.nodes.every((node) => used.has(node.id))) return graph
  return reindex(
    graph.nodes.filter((node) => used.has(node.id)),
    graph.edges,
  )
}

/** Renumérote sommets et arêtes de 0..n-1 après un filtrage. */
function reindex(nodes: GraphNode[], edges: GraphEdge[]): SkeletonGraph {
  const remap = new Map<number, number>()
  const nextNodes: GraphNode[] = nodes.map((node, index) => {
    remap.set(node.id, index)
    return { ...node, id: index, degree: 0 }
  })

  const nextEdges: GraphEdge[] = []
  for (const edge of edges) {
    const a = remap.get(edge.a)
    const b = remap.get(edge.b)
    if (a === undefined || b === undefined) continue
    nextEdges.push({ ...edge, id: nextEdges.length, a, b })
  }

  const graph: SkeletonGraph = { nodes: nextNodes, edges: nextEdges }
  computeDegrees(graph)
  return graph
}
