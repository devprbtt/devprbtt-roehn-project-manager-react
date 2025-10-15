# Documentação do Banco de Dados

Este documento detalha o esquema do banco de dados da aplicação, explicando cada tabela, suas colunas e relacionamentos. O backend utiliza SQLAlchemy como ORM, e os modelos estão definidos em `backend/database.py`.

## Visão Geral

O banco de dados é projetado para gerenciar projetos de automação residencial, incluindo a estrutura hierárquica de áreas e ambientes, os componentes de hardware (módulos, keypads), os circuitos elétricos e a lógica de automação (cenas e ações).

---

## Tabelas

### 1. `User`

Armazena as informações dos usuários que podem acessar o sistema.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Identificador único do usuário (Chave Primária). |
| `username` | String(80) | Nome de usuário para login. Deve ser único. |
| `email` | String(120) | Endereço de e-mail do usuário. Deve ser único. |
| `password_hash` | String(128) | Hash da senha do usuário para armazenamento seguro. |
| `role` | String(20) | Papel do usuário no sistema (ex: 'admin', 'user'). |

### 2. `Projeto`

Representa um projeto de automação. É a entidade central que agrupa todos os outros componentes.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Identificador único do projeto (Chave Primária). |
| `nome` | String(100) | Nome do projeto. Deve ser único. |
| `user_id` | Integer | ID do usuário que criou o projeto (Chave Estrangeira para `User`). |
| `status` | String(20) | Status atual do projeto (ex: 'ATIVO', 'INATIVO', 'CONCLUIDO'). |
| `data_criacao` | DateTime | Data e hora em que o projeto foi criado. |
| `data_ativo` | DateTime | Data e hora em que o status do projeto foi alterado para 'ATIVO'. |
| `data_inativo` | DateTime | Data e hora em que o status do projeto foi alterado para 'INATIVO'. |
| `data_concluido`| DateTime | Data e hora em que o status do projeto foi alterado para 'CONCLUIDO'. |

**Relacionamentos:**
*   `areas`: Um projeto pode ter múltiplas `Area`s.
*   `modulos`: Um projeto pode ter múltiplos `Modulo`s.
*   `keypads`: Um projeto pode ter múltiplos `Keypad`s.

### 3. `Area`

Define uma área física dentro de um projeto, como "Andar Térreo" ou "Área Externa".

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Identificador único da área (Chave Primária). |
| `nome` | String(100) | Nome da área. O nome deve ser único dentro de um mesmo projeto. |
| `projeto_id` | Integer | ID do projeto ao qual a área pertence (Chave Estrangeira para `Projeto`). |

**Relacionamentos:**
*   `ambientes`: Uma área pode conter múltiplos `Ambiente`s.

### 4. `Ambiente`

Representa um cômodo ou espaço específico dentro de uma `Area`, como "Sala de Estar" ou "Cozinha".

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Identificador único do ambiente (Chave Primária). |
| `nome` | String(100) | Nome do ambiente. O nome deve ser único dentro de uma mesma área. |
| `area_id` | Integer | ID da área à qual o ambiente pertence (Chave Estrangeira para `Area`). |

**Relacionamentos:**
*   `circuitos`: Um ambiente pode ter múltiplos `Circuito`s.
*   `keypads`: Um ambiente pode ter múltiplos `Keypad`s.
*   `quadros_eletricos`: Um ambiente pode ter múltiplos `QuadroEletrico`s.
*   `cenas`: Um ambiente pode ter múltiplas `Cena`s.

### 5. `QuadroEletrico`

Representa um quadro elétrico onde os módulos de automação são instalados.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Identificador único do quadro (Chave Primária). |
| `nome` | String(100) | Nome do quadro elétrico. O nome deve ser único dentro do mesmo ambiente. |
| `notes` | Text | Anotações ou observações sobre o quadro. |
| `ambiente_id` | Integer | ID do ambiente onde o quadro está localizado (Chave Estrangeira para `Ambiente`). |
| `projeto_id` | Integer | ID do projeto ao qual o quadro pertence (Chave Estrangeira para `Projeto`). |

**Relacionamentos:**
*   `modulos`: Um quadro elétrico pode conter múltiplos `Modulo`s.

### 6. `Circuito`

Define um circuito de iluminação ou outro dispositivo elétrico a ser controlado.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Identificador único do circuito (Chave Primária). |
| `identificador` | String(50) | Identificador único do circuito dentro do ambiente (ex: "C01"). |
| `nome` | String(100) | Nome descritivo do circuito (ex: "Luz Central"). |
| `tipo` | String(50) | Tipo do circuito (ex: "Iluminação", "Persiana, "HVAC"). |
| `dimerizavel` | Boolean | Indica se o circuito suporta dimerização. |
| `potencia` | Float | Potência total do circuito em Watts. |
| `ambiente_id` | Integer | ID do ambiente ao qual o circuito pertence (Chave Estrangeira para `Ambiente`). |
| `sak` | Integer | Número do terminal SAK associado. |
| `quantidade_saks` | Integer | Quantidade de terminais SAK utilizados. |

**Relacionamentos:**
*   `vinculacao`: O circuito pode estar vinculado a um canal de um `Modulo`.
*   `keypad_buttons`: Vários botões de `Keypad` podem controlar este circuito.

### 7. `Modulo`

Representa um módulo de hardware da Roehn, responsável por controlar os circuitos.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Identificador único do módulo (Chave Primária). |
| `nome` | String(100) | Nome do módulo. Deve ser único dentro do projeto. |
| `tipo` | String(50) | Modelo do módulo (ex: "DIM8", "RL12"). |
| `quantidade_canais`| Integer | Número de canais (saídas) que o módulo possui. |
| `projeto_id` | Integer | ID do projeto ao qual o módulo pertence (Chave Estrangeira para `Projeto`). |
| `hsnet` | Integer | Endereço HS-Net do módulo. |
| `dev_id` | Integer | ID do dispositivo na rede. |
| `quadro_eletrico_id`| Integer | ID do quadro onde o módulo está instalado (Chave Estrangeira para `QuadroEletrico`). |

**Relacionamentos:**
*   `vinculacoes`: Um módulo pode ter múltiplas `Vinculacao`s, uma para cada canal.

### 8. `Vinculacao`

Associa um `Circuito` a um canal específico de um `Modulo`.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Identificador único da vinculação (Chave Primária). |
| `circuito_id` | Integer | ID do circuito que está sendo vinculado (Chave Estrangeira para `Circuito`). |
| `modulo_id` | Integer | ID do módulo ao qual o circuito está sendo vinculado (Chave Estrangeira para `Modulo`). |
| `canal` | Integer | Número do canal no módulo que controlará o circuito. O par (`modulo_id`, `canal`) deve ser único. |

### 9. `Keypad`

Representa um teclado físico (keypad) da Roehn, usado para acionar cenas e circuitos.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Identificador único do keypad (Chave Primária). |
| `nome` | String(100) | Nome do keypad. Deve ser único dentro do ambiente. |
| `modelo` | String(50) | Modelo do keypad (ex: "RQR-K"). |
| `color` | String(20) | Cor do espelho do keypad. |
| `button_color` | String(20) | Cor dos botões do keypad. |
| `button_count` | Integer | Número de botões no keypad. |
| `hsnet` | Integer | Endereço HS-Net do keypad. Deve ser único dentro do projeto. |
| `dev_id` | Integer | ID do dispositivo na rede. |
| `ambiente_id` | Integer | ID do ambiente onde o keypad está instalado (Chave Estrangeira para `Ambiente`). |
| `projeto_id` | Integer | ID do projeto ao qual o keypad pertence (Chave Estrangeira para `Projeto`). |
| `notes` | Text | Anotações ou observações sobre o keypad. |
| `created_at` | DateTime | Data e hora de criação do registro. |
| `updated_at` | DateTime | Data e hora da última atualização do registro. |

**Relacionamentos:**
*   `buttons`: Um keypad possui múltiplos `KeypadButton`s.

### 10. `KeypadButton`

Representa um único botão em um `Keypad`.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Identificador único do botão (Chave Primária). |
| `keypad_id` | Integer | ID do keypad ao qual o botão pertence (Chave Estrangeira para `Keypad`). |
| `ordem` | Integer | Posição do botão no keypad (ex: 1, 2, 3...). |
| `engraver_text`| String(7) | Texto gravado no botão (máximo de 7 caracteres). |
| `icon` | String(50) | Ícone exibido no botão. |
| `rocker_style` | String(50) | Estilo do botão do tipo "rocker" (gangorra), ex: 'up-down'. |
| `guid` | String(36) | GUID único para o botão. |
| `circuito_id` | Integer | ID do `Circuito` que o botão controla diretamente (Chave Estrangeira para `Circuito`). |
| `cena_id` | Integer | ID da `Cena` que o botão aciona (Chave Estrangeira para `Cena`). |
| `modo` | Integer | Modo de operação do botão (ex: Toggle, On, Off). |
| `command_on` | Integer | Comando enviado ao pressionar (para ligar). |
| `command_off` | Integer | Comando enviado ao pressionar (para desligar). |
| `can_hold` | Boolean | Indica se o botão suporta a ação de "pressionar e segurar". |
| `is_rocker` | Boolean | Indica se o botão é do tipo "rocker" (gangorra). |
| `modo_double_press` | Integer | Modo de operação para o duplo clique. |
| `command_double_press`| Integer | Comando enviado no duplo clique. |
| `target_object_guid` | String(36) | GUID do objeto alvo (circuito ou cena). |
| `notes` | Text | Anotações ou observações sobre o botão. |
| `created_at` | DateTime | Data e hora de criação do registro. |
| `updated_at` | DateTime | Data e hora da última atualização do registro. |

**Relacionamentos:**
*   `cena`: O botão pode estar associado a uma `Cena`.

### 11. `Cena`

Define uma cena de automação, que é um conjunto de ações a serem executadas simultaneamente.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Identificador único da cena (Chave Primária). |
| `guid` | String(36) | GUID único para a cena. |
| `nome` | String(100) | Nome da cena. Deve ser único dentro do ambiente. |
| `ambiente_id` | Integer | ID do ambiente ao qual a cena pertence (Chave Estrangeira para `Ambiente`). |
| `scene_movers`| Boolean | Indica se a cena controla "scene movers". |

**Relacionamentos:**
*   `acoes`: Uma cena é composta por uma ou mais `Acao`s.
*   `keypad_buttons`: Vários botões de `Keypad` podem acionar esta cena.

### 12. `Acao`

Representa uma ação individual dentro de uma `Cena`, como ligar um circuito a um determinado nível.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Identificador único da ação (Chave Primária). |
| `cena_id` | Integer | ID da cena à qual a ação pertence (Chave Estrangeira para `Cena`). |
| `level` | Integer | Nível de intensidade (0-100) para a ação (ex: nível de dimerização). |
| `action_type` | Integer | Tipo de ação (ex: 0 para Circuito, 7 para Grupo). |
| `target_guid` | String(36) | GUID do objeto alvo da ação (ex: GUID de um circuito). |

**Relacionamentos:**
*   `custom_acoes`: Se a ação for do tipo "Grupo", ela pode ter ações customizadas para circuitos específicos dentro do grupo.

### 13. `CustomAcao`

Permite customizar o comportamento de um circuito individual quando ele faz parte de um grupo em uma `Acao`.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Identificador único da ação customizada (Chave Primária). |
| `acao_id` | Integer | ID da ação de grupo à qual esta customização pertence (Chave Estrangeira para `Acao`). |
| `target_guid` | String(36) | GUID do circuito específico dentro do grupo que terá um comportamento customizado. |
| `enable` | Boolean | Se `false`, o circuito não será afetado pela ação do grupo. |
| `level` | Integer | Nível de intensidade customizado (0-100) para este circuito específico. |
