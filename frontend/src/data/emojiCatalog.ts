import type {
  EmojiCatalogItem,
  EmojiCategoryId,
} from "../types/emoji.types";

type EmojiTuple = readonly [
  emoji: string,
  shortcode: string,
  name: string,
  ...keywords: string[],
];

const catalogSource: Record<EmojiCategoryId, readonly EmojiTuple[]> = {
  faces: [
    ["😀", "sorriso_aberto", "Rosto sorridente", "feliz", "alegre"],
    ["😃", "sorriso_olhos_grandes", "Sorriso com olhos grandes", "felicidade", "animado"],
    ["😄", "sorriso_olhos_fechados", "Sorriso com olhos fechados", "riso", "alegria"],
    ["😁", "sorriso_radiante", "Rosto radiante", "dentes", "contente"],
    ["😊", "sorriso_timido", "Sorriso tímido", "fofo", "corado"],
    ["🥰", "apaixonado", "Rosto apaixonado", "amor", "carinho", "corações"],
    ["😍", "olhos_de_coracao", "Olhos de coração", "amor", "paixão"],
    ["😘", "beijo", "Mandando beijo", "amor", "carinho"],
    ["😌", "aliviado", "Rosto aliviado", "calmo", "paz"],
    ["😉", "piscando", "Rosto piscando", "brincadeira", "cumplicidade"],
    ["🤔", "pensando", "Rosto pensando", "dúvida", "refletir"],
    ["🤭", "rindo_escondido", "Riso escondido", "segredo", "ops"],
    ["😎", "oculos_escuros", "Rosto com óculos escuros", "legal", "verão"],
    ["🥳", "festa", "Rosto festejando", "aniversário", "comemorar"],
    ["😴", "dormindo", "Rosto dormindo", "sono", "cansado"],
    ["😭", "chorando_muito", "Rosto chorando muito", "triste", "lágrimas"],
    ["😡", "bravo", "Rosto bravo", "raiva", "irritado"],
    ["🤯", "mente_explodindo", "Mente explodindo", "surpresa", "incrível"],
  ],
  people: [
    ["👋", "aceno", "Mão acenando", "oi", "tchau", "olá"],
    ["🤚", "mao_levantada", "Mão levantada", "pare", "presente"],
    ["👌", "ok", "Sinal de OK", "certo", "perfeito"],
    ["✌️", "paz", "Sinal de paz", "vitória", "dois"],
    ["🤞", "dedos_cruzados", "Dedos cruzados", "sorte", "torcer"],
    ["👍", "positivo", "Polegar para cima", "aprovar", "curtir", "sim"],
    ["👎", "negativo", "Polegar para baixo", "reprovar", "não"],
    ["👏", "palmas", "Mãos aplaudindo", "parabéns", "aplauso"],
    ["🙌", "celebracao", "Mãos celebrando", "viva", "conquista"],
    ["🙏", "agradecimento", "Mãos juntas", "obrigado", "oração", "por favor"],
    ["💪", "forca", "Braço forte", "músculo", "coragem"],
    ["👀", "olhos", "Olhos atentos", "ver", "observar"],
    ["🧠", "cerebro", "Cérebro", "ideia", "pensamento", "mente"],
    ["🧑‍💻", "pessoa_programando", "Pessoa programando", "computador", "trabalho", "código"],
    ["🧑‍🎨", "pessoa_artista", "Pessoa artista", "arte", "criatividade"],
    ["🧑‍🚀", "pessoa_astronauta", "Pessoa astronauta", "espaço", "explorar"],
    ["🧘", "meditacao", "Pessoa meditando", "calma", "yoga", "bem-estar"],
    ["🤝", "aperto_de_maos", "Aperto de mãos", "acordo", "parceria"],
  ],
  animals: [
    ["🐶", "cachorro", "Rosto de cachorro", "cão", "pet"],
    ["🐱", "gato", "Rosto de gato", "felino", "pet"],
    ["🐰", "coelho", "Rosto de coelho", "bunny", "pet"],
    ["🦊", "raposa", "Rosto de raposa", "animal", "floresta"],
    ["🐻", "urso", "Rosto de urso", "animal", "floresta"],
    ["🐼", "panda", "Rosto de panda", "urso", "fofo"],
    ["🐨", "coala", "Rosto de coala", "austrália", "fofo"],
    ["🐯", "tigre", "Rosto de tigre", "felino", "selvagem"],
    ["🦁", "leao", "Rosto de leão", "felino", "selvagem"],
    ["🐸", "sapo", "Rosto de sapo", "rã", "lago"],
    ["🐵", "macaco", "Rosto de macaco", "selva", "animal"],
    ["🐧", "pinguim", "Pinguim", "gelo", "ave"],
    ["🐦", "passaro", "Pássaro", "ave", "voar"],
    ["🦋", "borboleta", "Borboleta", "inseto", "natureza"],
    ["🐝", "abelha", "Abelha", "mel", "inseto"],
    ["🐢", "tartaruga", "Tartaruga", "lento", "mar"],
    ["🐙", "polvo", "Polvo", "oceano", "mar"],
    ["🐳", "baleia", "Baleia", "oceano", "mar"],
  ],
  food: [
    ["🍎", "maca", "Maçã vermelha", "fruta", "saudável"],
    ["🍓", "morango", "Morango", "fruta", "doce"],
    ["🍊", "laranja", "Laranja", "fruta", "cítrico"],
    ["🍋", "limao", "Limão", "fruta", "azedo"],
    ["🍉", "melancia", "Melancia", "fruta", "verão"],
    ["🍇", "uvas", "Uvas", "fruta", "cacho"],
    ["🍒", "cerejas", "Cerejas", "fruta", "vermelho"],
    ["🥑", "abacate", "Abacate", "fruta", "saudável"],
    ["🥐", "croissant", "Croissant", "pão", "café da manhã"],
    ["🍞", "pao", "Pão", "padaria", "café da manhã"],
    ["🧀", "queijo", "Queijo", "lanche", "comida"],
    ["🍕", "pizza", "Pizza", "comida", "fatia"],
    ["🍔", "hamburguer", "Hambúrguer", "lanche", "comida"],
    ["🍣", "sushi", "Sushi", "japonês", "comida"],
    ["🍰", "bolo", "Fatia de bolo", "doce", "aniversário"],
    ["🍪", "biscoito", "Biscoito", "cookie", "doce"],
    ["☕", "cafe", "Café quente", "bebida", "xícara"],
    ["🧃", "suco", "Caixa de suco", "bebida", "canudo"],
  ],
  activities: [
    ["⚽", "futebol", "Bola de futebol", "esporte", "jogo"],
    ["🏀", "basquete", "Bola de basquete", "esporte", "jogo"],
    ["🏐", "volei", "Bola de vôlei", "esporte", "jogo"],
    ["🎾", "tenis", "Bola de tênis", "esporte", "raquete"],
    ["🏓", "pingue_pongue", "Tênis de mesa", "esporte", "raquete"],
    ["🏊", "natacao", "Pessoa nadando", "esporte", "piscina"],
    ["🚴", "ciclismo", "Pessoa pedalando", "bicicleta", "esporte"],
    ["🏆", "trofeu", "Troféu", "vitória", "prêmio"],
    ["🎨", "paleta", "Paleta de pintura", "arte", "cores"],
    ["🎭", "teatro", "Máscaras de teatro", "arte", "atuação"],
    ["🎬", "cinema", "Claquete", "filme", "vídeo"],
    ["🎤", "microfone", "Microfone", "cantar", "música"],
    ["🎧", "fones", "Fones de ouvido", "música", "áudio"],
    ["🎸", "violao", "Guitarra", "música", "instrumento"],
    ["🎮", "videogame", "Controle de videogame", "jogo", "gamer"],
    ["🧩", "quebra_cabeca", "Peça de quebra-cabeça", "puzzle", "jogo"],
    ["🎯", "alvo", "Alvo certeiro", "meta", "objetivo"],
    ["🎲", "dado", "Dado de jogo", "sorte", "tabuleiro"],
  ],
  travel: [
    ["🚗", "carro", "Carro", "automóvel", "dirigir"],
    ["🚌", "onibus", "Ônibus", "transporte", "cidade"],
    ["🚲", "bicicleta", "Bicicleta", "pedalar", "transporte"],
    ["✈️", "aviao", "Avião", "viagem", "voo"],
    ["🚀", "foguete", "Foguete", "espaço", "lançamento"],
    ["🚢", "navio", "Navio", "cruzeiro", "mar"],
    ["🏠", "casa", "Casa", "lar", "moradia"],
    ["🏙️", "cidade", "Paisagem urbana", "prédios", "viagem"],
    ["🏖️", "praia", "Praia com guarda-sol", "férias", "mar"],
    ["🏕️", "acampamento", "Acampamento", "barraca", "natureza"],
    ["🗺️", "mapa", "Mapa-múndi", "viagem", "localização"],
    ["🧭", "bussola", "Bússola", "direção", "explorar"],
    ["🌍", "planeta", "Planeta Terra", "mundo", "globo"],
    ["🌋", "vulcao", "Vulcão", "natureza", "montanha"],
    ["⛰️", "montanha", "Montanha", "trilha", "natureza"],
    ["🌅", "nascer_do_sol", "Nascer do sol", "manhã", "paisagem"],
    ["🌌", "via_lactea", "Via Láctea", "noite", "estrelas"],
    ["🧳", "mala", "Mala de viagem", "bagagem", "férias"],
  ],
  objects: [
    ["📚", "livros", "Pilha de livros", "estudo", "leitura"],
    ["📖", "livro_aberto", "Livro aberto", "ler", "estudo"],
    ["📝", "anotacao", "Bloco de anotação", "escrever", "nota"],
    ["✏️", "lapis", "Lápis", "escrever", "desenhar"],
    ["🖊️", "caneta", "Caneta", "escrever", "tinta"],
    ["📌", "alfinete", "Alfinete", "fixar", "importante"],
    ["📎", "clipe", "Clipe de papel", "anexo", "escritório"],
    ["📅", "calendario", "Calendário", "data", "agenda"],
    ["⏰", "despertador", "Despertador", "hora", "lembrete"],
    ["💡", "lampada", "Lâmpada", "ideia", "inspiração"],
    ["📷", "camera", "Câmera", "foto", "imagem"],
    ["💻", "notebook", "Computador portátil", "trabalho", "tecnologia"],
    ["📱", "celular", "Telefone celular", "smartphone", "tecnologia"],
    ["🔒", "cadeado", "Cadeado fechado", "segurança", "privado"],
    ["🔑", "chave", "Chave", "acesso", "abrir"],
    ["🎁", "presente", "Presente", "surpresa", "aniversário"],
    ["💌", "carta_de_amor", "Carta de amor", "mensagem", "carinho"],
    ["🕯️", "vela", "Vela", "luz", "calma"],
  ],
  symbols: [
    ["❤️", "coracao_vermelho", "Coração vermelho", "amor", "favorito"],
    ["🧡", "coracao_laranja", "Coração laranja", "amor", "carinho"],
    ["💛", "coracao_amarelo", "Coração amarelo", "amor", "amizade"],
    ["💚", "coracao_verde", "Coração verde", "amor", "natureza"],
    ["💙", "coracao_azul", "Coração azul", "amor", "calma"],
    ["💜", "coracao_roxo", "Coração roxo", "amor", "carinho"],
    ["🤍", "coracao_branco", "Coração branco", "amor", "paz"],
    ["✨", "brilhos", "Brilhos", "mágica", "destaque"],
    ["⭐", "estrela", "Estrela", "favorito", "destaque"],
    ["🔥", "fogo", "Fogo", "quente", "popular"],
    ["✅", "confirmado", "Marca de confirmação", "feito", "certo"],
    ["❌", "cancelado", "Marca de X", "errado", "não"],
    ["❗", "exclamacao", "Exclamação", "atenção", "importante"],
    ["❓", "interrogacao", "Interrogação", "dúvida", "pergunta"],
    ["💬", "balao_de_fala", "Balão de fala", "comentário", "mensagem"],
    ["💭", "balao_de_pensamento", "Balão de pensamento", "ideia", "pensar"],
    ["♻️", "reciclagem", "Símbolo de reciclagem", "sustentável", "reutilizar"],
    ["➕", "mais", "Sinal de mais", "adicionar", "novo"],
  ],
};

export const EMOJI_FONT_FAMILY = "Noto Color Emoji";

export const emojiCatalog: EmojiCatalogItem[] = Object.entries(catalogSource).flatMap(
  ([category, items]) =>
    items.map(([emoji, shortcode, name, ...keywords]) => ({
      id: `unicode:${shortcode}`,
      provider: "noto-color-emoji" as const,
      shortcode,
      emoji,
      name,
      keywords,
      category: category as EmojiCategoryId,
      asset: { kind: "font" as const, fontFamily: EMOJI_FONT_FAMILY },
    })),
);

export const emojiById = new Map(emojiCatalog.map((item) => [item.id, item]));

export function normalizeEmojiSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function searchEmojiCatalog(query: string): EmojiCatalogItem[] {
  const normalizedQuery = normalizeEmojiSearch(query);
  if (!normalizedQuery) {
    return emojiCatalog;
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  return emojiCatalog.filter((item) => {
    const searchable = normalizeEmojiSearch(
      [item.name, item.shortcode.replaceAll("_", " "), ...item.keywords].join(" "),
    );
    return terms.every((term) => searchable.includes(term));
  });
}
