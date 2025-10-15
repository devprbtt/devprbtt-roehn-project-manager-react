# Documentação do Banco de Dados

Este documento detalha a estrutura do banco de dados da aplicação, descrevendo cada tabela, suas colunas e os relacionamentos entre elas. O banco de dados foi projetado para gerenciar projetos de automação residencial, incluindo a organização de áreas, ambientes, circuitos de iluminação, módulos de controle e keypads.

## Diagrama de Relacionamento (Conceitual)

```
[User] -> [Projeto]

[Projeto] --< [Area]
[Projeto] --< [Modulo]
[Projeto] --< [Keypad]
[Projeto] --< [QuadroEletrico]

[Area] --< [Ambiente]

[Ambiente] --< [Circuito]
[Ambiente] --< [Keypad]
[Ambiente] --< [QuadroEletrico]
[Ambiente] --< [Cena]

[QuadroEletrico] --< [Modulo]

[Modulo] --< [Vinculacao]

[Circuito] --< [Vinculacao]
[Circuito] --< [KeypadButton]

[Keypad] --< [KeypadButton]

[Cena] --< [Acao]
[Cena] --< [KeypadButton]

[Acao] --< [CustomAcao]
```

---

## Tabelas

### 1. `User`

Armazena as informações dos usuários que podem acessar o sistema.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | Integer | Identificador único do usuário (Chave Primária). |
| `username` | String | Nome de usuário para login. Deve ser único. |
| `email` | String | Endereço de e-mail do usuário. Deve ser único. |
| `password_hash` | String | Hash da senha do usuário para armazenamento seguro. |
| `role` | String | Papel do usuário no sistema (ex: 'admin', 'user'). |

---

### 2. `Projeto`

Tabela central que representa um projeto de automação. Um projeto engloba todas as outras entidades como áreas, módulos e keypads.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | Integer | Identificador único do projeto (Chave Primária). |
| `nome` | String | Nome do projeto. Deve ser único. |
| `user_id` | Integer | Chave estrangeira para a tabela `User`, indicando o proprietário do projeto. |
| `status` | String | Status atual do projeto (ex: 'ATIVO', 'INATIVO', 'CONCLUIDO'). |
| `data_criacao` | DateTime | Data e hora em que o projeto foi criado. |
| `data_ativo` | DateTime | Data em que o status do projeto foi alterado para 'ATIVO'. |
| `data_inativo` | DateTime | Data em que o status do projeto foi alterado para 'INATIVO'. |
| `data_concluido`| DateTime | Data em que o status do projeto foi alterado para 'CONCLUIDO'. |
| `areas` | Relationship | Relacionamento com as `Area`s que pertencem a este projeto. |
| `modulos` | Relationship | Relacionamento com os `Modulo`s que pertencem a este projeto. |
| `keypads` | Relationship | Relacionamento com os `Keypad`s que pertencem a este projeto. |

---

### 3. `Area`

Define uma área física dentro de um projeto, como "Andar Térreo" ou "Área Externa".

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | Integer | Identificador único da área (Chave Primária). |
| `nome` | String | Nome da área (ex: "Andar 1"). O nome deve ser único dentro de um mesmo projeto. |
| `projeto_id` | Integer | Chave estrangeira para a tabela `Projeto`. |
| `ambientes` | Relationship | Relacionamento com os `Ambiente`s que pertencem a esta área. |

---

### 4. `Ambiente`

Representa um cômodo ou espaço específico dentro de uma `Area`, como "Sala de Estar" ou "Cozinha".

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | Integer | Identificador único do ambiente (Chave Primária). |
| `nome` | String | Nome do ambiente (ex: "Quarto Suíte"). O nome deve ser único dentro de uma mesma área. |
| `area_id` | Integer | Chave estrangeira para a tabela `Area`. |
| `circuitos` | Relationship | Relacionamento com os `Circuito`s localizados neste ambiente. |
| `keypads` | Relationship | Relacionamento com os `Keypad`s instalados neste ambiente. |
| `quadros_eletricos` | Relationship | Relacionamento com os `QuadroEletrico`s deste ambiente. |
| `cenas` | Relationship | Relacionamento com as `Cena`s configuradas para este ambiente. |

---

### 5. `QuadroEletrico`

Representa um quadro elétrico, que é o local físico onde os módulos de automação são instalados.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | Integer | Identificador único do quadro elétrico (Chave Primária). |
| `nome` | String | Nome do quadro (ex: "QDF-01"). O nome deve ser único dentro de um mesmo ambiente. |
| `notes` | Text | Anotações ou observações sobre o quadro. |
| `ambiente_id` | Integer | Chave estrangeira para a tabela `Ambiente` onde o quadro está localizado. |
| `projeto_id` | Integer | Chave estrangeira para a tabela `Projeto`. |
| `modulos` | Relationship | Relacionamento com os `Modulo`s instalados neste quadro. |

---

### 6. `Circuito`

Define um circuito de iluminação ou outro dispositivo elétrico a ser controlado.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | Integer | Identificador único do circuito (Chave Primária). |
| `identificador` | String | Identificador único do circuito dentro do ambiente (ex: "C01"). |
| `nome` | String | Nome descritivo do circuito (ex: "Spots Sanca"). |
| `tipo` | String | Tipo do circuito (ex: "Iluminação", "Tomada"). |
| `dimerizavel` | Boolean | Indica se o circuito suporta dimerização. |
| `potencia` | Float | Potência total do circuito em Watts. |
| `ambiente_id` | Integer | Chave estrangeira para a tabela `Ambiente`. |
| `sak` | Integer | Número do conector SAK no quadro elétrico. |
| `quantidade_saks` | Integer | Quantidade de conectores SAK que o circuito utiliza. |
| `vinculacao` | Relationship | Relacionamento com a `Vinculacao`, que o conecta a um módulo. |
| `keypad_buttons` | Relationship | Relacionamento com os botões de `KeypadButton` que controlam este circuito. |

---

### 7. `Modulo`

Representa um módulo de hardware (ex: dimmer, switch) que controla os circuitos.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | Integer | Identificador único do módulo (Chave Primária). |
| `nome` | String | Nome do módulo. Deve ser único dentro do projeto. |
| `tipo` | String | Modelo do módulo (ex: "RQR-DIM4", "RQR-RLC8"). |
| `quantidade_canais`| Integer | Número de canais (saídas) que o módulo possui. |
| `projeto_id` | Integer | Chave estrangeira para a tabela `Projeto`. |
| `hsnet` | Integer | Endereço do módulo na rede HS-NET. |
| `dev_id` | Integer | ID do dispositivo na rede. |
| `quadro_eletrico_id`| Integer | Chave estrangeira para o `QuadroEletrico` onde o módulo está instalado. |
| `vinculacoes` | Relationship | Relacionamento com as `Vinculacao`s, que ligam seus canais a circuitos. |

---

### 8. `Vinculacao`

Tabela de associação que conecta um `Circuito` a um canal específico de um `Modulo`.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | Integer | Identificador único da vinculação (Chave Primária). |
| `circuito_id` | Integer | Chave estrangeira para a tabela `Circuito`. |
| `modulo_id` | Integer | Chave estrangeira para a tabela `Modulo`. |
| `canal` | Integer | Número do canal no módulo ao qual o circuito está conectado. O par `(modulo_id, canal)` deve ser único. |

---

### 9. `Keypad`

Representa um teclado físico (keypad) instalado em um ambiente.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | Integer | Identificador único do keypad (Chave Primária). |
| `nome` | String | Nome do keypad. Deve ser único dentro do ambiente. |
| `modelo` | String | Modelo do keypad (ex: "RQR-K"). |
| `color` | String | Cor do espelho do keypad. |
| `button_color` | String | Cor dos botões do keypad. |
| `button_count` | Integer | Número de botões do keypad. |
| `hsnet` | Integer | Endereço do keypad na rede HS-NET. Deve ser único por projeto. |
| `dev_id` | Integer | ID do dispositivo na rede. |
| `ambiente_id` | Integer | Chave estrangeira para o `Ambiente` onde está instalado. |
| `projeto_id` | Integer | Chave estrangeira para a tabela `Projeto`. |
| `notes` | Text | Anotações sobre o keypad. |
| `buttons` | Relationship | Relacionamento com os `KeypadButton`s que pertencem a este keypad. |

---

### 10. `KeypadButton`

Representa um único botão em um `Keypad`. Cada botão pode ser configurado para controlar um circuito ou acionar uma cena.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | Integer | Identificador único do botão (Chave Primária). |
| `keypad_id` | Integer | Chave estrangeira para a tabela `Keypad`. |
| `ordem` | Integer | Posição do botão no keypad (ex: 1, 2, 3...). |
| `engraver_text`| String | Texto gravado no botão (máximo de 7 caracteres). |
| `icon` | String | Ícone exibido no botão. |
| `rocker_style` | String | Estilo do botão, se for do tipo gangorra (ex: 'up-down'). |
| `guid` | String | Identificador único global (UUID) para o botão. |
| `circuito_id` | Integer | Chave estrangeira para o `Circuito` que este botão controla (pode ser nulo). |
| `cena_id` | Integer | Chave estrangeira para a `Cena` que este botão aciona (pode ser nulo). |
| `modo` | Integer | Modo de operação do botão (ex: Toggle, On, Off). |
| `is_rocker` | Boolean | Indica se o botão é do tipo gangorra (rocker). |
| `...` | ... | Outras colunas para configuração de comandos, duplo clique, etc. |
| `cena` | Relationship | Relacionamento com a `Cena` que este botão pode controlar. |

---

### 11. `Cena`

Representa uma cena de iluminação, que é um conjunto de estados pré-definidos para vários circuitos em um ambiente.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | Integer | Identificador único da cena (Chave Primária). |
| `guid` | String | Identificador único global (UUID) para a cena. |
| `nome` | String | Nome da cena (ex: "Jantar", "Cinema"). Deve ser único por ambiente. |
| `ambiente_id` | Integer | Chave estrangeira para a tabela `Ambiente`. |
| `scene_movers`| Boolean | Indica se a cena utiliza "scene movers". |
| `acoes` | Relationship | Relacionamento com as `Acao`s que compõem a cena. |
| `keypad_buttons` | Relationship | Relacionamento com os `KeypadButton`s que acionam esta cena. |

---

### 12. `Acao`

Representa uma ação específica dentro de uma `Cena`, como ligar um circuito a 50% de intensidade.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | Integer | Identificador único da ação (Chave Primária). |
| `cena_id` | Integer | Chave estrangeira para a tabela `Cena`. |
| `level` | Integer | Nível de intensidade (0-100) para o alvo da ação. |
| `action_type` | Integer | Tipo de ação (ex: 0 para Circuito, 7 para Grupo). |
| `target_guid` | String | GUID do alvo da ação (pode ser o GUID de um circuito ou grupo). |
| `custom_acoes` | Relationship | Relacionamento com `CustomAcao`s, para ações em grupos. |

---

### 13. `CustomAcao`

Usada para detalhar as ações quando o alvo de uma `Acao` é um grupo, permitindo definir níveis individuais para circuitos dentro do grupo.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | Integer | Identificador único da ação customizada (Chave Primária). |
| `acao_id` | Integer | Chave estrangeira para a tabela `Acao`. |
| `target_guid` | String | GUID do circuito específico dentro do grupo. |
| `enable` | Boolean | Indica se esta ação customizada está ativa. |
| `level` | Integer | Nível de intensidade (0-100) para este circuito específico. |