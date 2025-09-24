# roehn_converter.py
import json
import csv
import uuid
import io
from datetime import datetime
from database import db, User, Projeto, Area, Ambiente, Circuito, Modulo, Vinculacao, Keypad, KeypadButton

class RoehnProjectConverter:
    # --- AQUI ESTÁ A CORREÇÃO ---
    # O construtor agora aceita o ID do usuário logado
    def __init__(self, projeto_data, db_session, user_id):
        self.project_data = projeto_data
        self.db_session = db_session
        self.user_id = user_id # Armazena o ID do usuário
        self.modules_info = {
            'ADP-RL12': {'driver_guid': '80000000-0000-0000-0000-000000000006', 'slots': {'Load ON/OFF': 12}},
            'RL4': {'driver_guid': '80000000-0000-0000-0000-000000000010', 'slots': {'Load ON/OFF': 4}},
            'LX4': {'driver_guid': '80000000-0000-0000-0000-000000000003', 'slots': {'Shade': 4}},
            'SA1': {'driver_guid': '80000000-0000-0000-0000-000000000013', 'slots': {'IR': 1}},
            'DIM8': {'driver_guid': '80000000-0000-0000-0000-000000000001', 'slots': {'Load Dim': 8}}
        }
        self.zero_guid = "00000000-0000-0000-0000-000000000000"
        self.keypad_driver_guid = "90000000-0000-0000-0000-000000000004"
        self.keypad_profile_guid = "40000000-0000-0000-0000-000000000001"
        self.keypad_rocker_icon_guid = "11000000-0000-0000-0000-000000000001"
        self.keypad_button_layouts = {1: 1, 2: 6, 4: 7}

    def process_json_project(self):
        try:
            # Obtenha os dados do projeto exportado (apenas para nome, etc.)
            project_info = self.project_data.get('projeto', {})
            project_name = project_info.get('nome')
            
            if not project_name:
                raise Exception("O nome do projeto não foi encontrado no JSON. Verifique se o arquivo é válido.")

            # --- AQUI ESTÁ A CORREÇÃO ---
            # Crie o novo projeto e use o ID do usuário logado
            projeto = Projeto(nome=project_name, user_id=self.user_id)
            self.db_session.add(projeto)
            self.db_session.flush()

            # ... (o restante da sua lógica de importação de áreas, ambientes, etc.)

            # Processamento de Áreas
            for area_data in self.project_data.get('areas', []):
                area = Area(nome=area_data.get('nome'), projeto_id=projeto.id)
                self.db_session.add(area)
                self.db_session.flush()

                # Processamento de Ambientes
                for ambiente_data in self.project_data.get('ambientes', []):
                    if ambiente_data.get('area_id') == area_data.get('id'):
                        ambiente = Ambiente(nome=ambiente_data.get('nome'), area_id=area.id)
                        self.db_session.add(ambiente)
                        self.db_session.flush()

                        # Processamento de Circuitos
                        for circuito_data in self.project_data.get('circuitos', []):
                            if circuito_data.get('ambiente_id') == ambiente_data.get('id'):
                                circuito = Circuito(
                                    identificador=circuito_data.get('identificador'),
                                    nome=circuito_data.get('nome'),
                                    tipo=circuito_data.get('tipo'),
                                    ambiente_id=ambiente.id,
                                    sak=circuito_data.get('sak')
                                )
                                self.db_session.add(circuito)
                                self.db_session.flush()

            # Processamento de Módulos (fora do loop de ambientes)
            for modulo_data in self.project_data.get('modulos', []):
                modulo = Modulo(
                    nome=modulo_data.get('nome'),
                    tipo=modulo_data.get('tipo'),
                    quantidade_canais=modulo_data.get('quantidade_canais'),
                    projeto_id=projeto.id
                )
                self.db_session.add(modulo)

            # Processamento de Vinculacoes (fora do loop)
            for vinculacao_data in self.project_data.get('vinculacoes', []):
                # ... (sua lógica para criar a vinculacao)
                pass # ou adicione sua lógica aqui

            self.db_session.commit()
            print("Importação concluída com sucesso!")

        except Exception as e:
            self.db_session.rollback()
            raise Exception(f"Erro ao processar dados do JSON: {e}")


    def process_db_project(self, projeto):
        """Processa os dados do projeto do banco de dados para o formato Roehn"""
        print(f"Processando projeto: {projeto.nome}")
        print(f"Numero de areas: {len(projeto.areas)}")

        self._circuit_guid_map = {}

        for area in projeto.areas:
            print(f"Processando area: {area.nome}")
            self._ensure_area_exists(area.nome)

            for ambiente in area.ambientes:
                print(f"Processando ambiente: {ambiente.nome}")
                self._ensure_room_exists(area.nome, ambiente.nome)

        for modulo in projeto.modulos:
            print(f"Processando modulo: {modulo.nome} ({modulo.tipo})")
            self._ensure_module_exists(modulo)

        for area in projeto.areas:
            for ambiente in area.ambientes:
                for circuito in ambiente.circuitos:
                    print(f"Processando circuito: {circuito.identificador} ({circuito.tipo})")
                    if circuito.vinculacao:
                        vinculacao = circuito.vinculacao
                        modulo = vinculacao.modulo
                        canal = vinculacao.canal
                        modulo_nome = modulo.nome if modulo else None

                        if not modulo_nome:
                            print(f"Circuito {circuito.identificador} sem modulo associado, ignorando.")
                            continue

                        try:
                            if circuito.tipo == 'luz':
                                # ⭐⭐⭐ NOVO: Obter informação de dimerizável do circuito
                                dimerizavel = getattr(circuito, 'dimerizavel', False)
                                guid = self._add_load(
                                    area.nome, 
                                    ambiente.nome, 
                                    circuito.nome or circuito.identificador,
                                    dimerizavel=dimerizavel  # ⭐⭐⭐ NOVO PARÂMETRO
                                )
                                self._circuit_guid_map[circuito.id] = guid
                                self._link_load_to_module(guid, modulo_nome, canal)
                                print(f"Circuito de luz adicionado: {guid} (Dimerizável: {dimerizavel})")  # ⭐⭐⭐ LOG ATUALIZADO
                            elif circuito.tipo == 'persiana':
                                guid = self._add_shade(area.nome, ambiente.nome, circuito.nome or circuito.identificador)
                                self._circuit_guid_map[circuito.id] = guid
                                self._link_shade_to_module(guid, modulo_nome, canal)
                                print(f"Circuito de persiana adicionado: {guid}")
                            elif circuito.tipo == 'hvac':
                                guid = self._add_hvac(area.nome, ambiente.nome, circuito.nome or circuito.identificador)
                                self._circuit_guid_map[circuito.id] = guid
                                self._link_hvac_to_module(guid, modulo_nome, canal)
                                print(f"Circuito HVAC adicionado: {guid}")
                            else:
                                print(f"Tipo de circuito nao suportado: {circuito.tipo}")
                        except Exception as exc:
                            print(f"Erro ao processar circuito {circuito.id}: {exc}")
                            continue
                    else:
                        print(f"Circuito {circuito.id} nao vinculado, ignorando.")

                self._add_keypads_for_room(area.nome, ambiente)

    def create_project(self, project_info):
        """Cria um projeto base compatível com o ROEHN Wizard"""
        project_guid = str(uuid.uuid4())
        now_iso = datetime.now().isoformat()
        
        # No método create_project, substitua a definição do m4_module por:

        # Módulo base M4 (obrigatório) com UnitComposers
        m4_module_guid = str(uuid.uuid4())
        m4_unit_composers = []

        # Lista de UnitComposers para o M4 baseada no exemplo do Roehn Wizard
        m4_composers_data = [
            {"Name": "Ativo", "PortNumber": 1, "PortType": 0, "IO": 0, "Kind": 0, "NotProgrammable": False},
            {"Name": "Modulos HSNET ativos", "PortNumber": 1, "PortType": 600, "IO": 0, "Kind": 1, "NotProgrammable": False},
            {"Name": "Modulos HSNET registrados", "PortNumber": 2, "PortType": 600, "IO": 0, "Kind": 1, "NotProgrammable": False},
            {"Name": "Data", "PortNumber": 3, "PortType": 600, "IO": 1, "Kind": 1, "NotProgrammable": True},
            {"Name": "Hora", "PortNumber": 4, "PortType": 600, "IO": 1, "Kind": 1, "NotProgrammable": True},
            {"Name": "DST", "PortNumber": 2, "PortType": 0, "IO": 0, "Kind": 0, "NotProgrammable": False},
            {"Name": "Nascer do Sol", "PortNumber": 5, "PortType": 600, "IO": 1, "Kind": 1, "NotProgrammable": True},
            {"Name": "Por do sol", "PortNumber": 6, "PortType": 600, "IO": 1, "Kind": 1, "NotProgrammable": True},
            {"Name": "Posição Solar", "PortNumber": 7, "PortType": 600, "IO": 0, "Kind": 1, "NotProgrammable": False},
            {"Name": "Flag RTC", "PortNumber": 8, "PortType": 600, "IO": 0, "Kind": 1, "NotProgrammable": False},
            {"Name": "Flag SNTP", "PortNumber": 9, "PortType": 600, "IO": 0, "Kind": 1, "NotProgrammable": False},
            {"Name": "Flag MYIP", "PortNumber": 10, "PortType": 600, "IO": 0, "Kind": 1, "NotProgrammable": False},
            {"Name": "Flag DDNS", "PortNumber": 11, "PortType": 600, "IO": 0, "Kind": 1, "NotProgrammable": False},
            {"Name": "Web IP", "PortNumber": 1, "PortType": 1100, "IO": 0, "Kind": 1, "NotProgrammable": False},
            {"Name": "Ultima inicializacao", "PortNumber": 2, "PortType": 1100, "IO": 0, "Kind": 1, "NotProgrammable": False},
            {"Name": "Tensao", "PortNumber": 12, "PortType": 600, "IO": 0, "Kind": 1, "NotProgrammable": False},
            {"Name": "Corrente", "PortNumber": 13, "PortType": 600, "IO": 0, "Kind": 1, "NotProgrammable": False},
            {"Name": "Power", "PortNumber": 14, "PortType": 600, "IO": 0, "Kind": 1, "NotProgrammable": False},
            {"Name": "Temperatura", "PortNumber": 15, "PortType": 600, "IO": 0, "Kind": 1, "NotProgrammable": False},
        ]

        # Iniciar IDs a partir de 39, conforme o exemplo
        next_unit_id = 39

        for composer in m4_composers_data:
            unit_composer = {
                "$type": "UnitComposer",
                "Name": composer["Name"],
                "PortNumber": composer["PortNumber"],
                "PortType": composer["PortType"],
                "IO": composer["IO"],
                "Kind": composer["Kind"],
                "NotProgrammable": composer["NotProgrammable"],
                "Unit": {
                    "$type": "Unit",
                    "Id": next_unit_id,
                    "Event": 0,
                    "Scene": 0,
                    "Disabled": False,
                    "Logged": False,
                    "Memo": False,
                    "Increment": False
                },
                "Value": 0
            }
            m4_unit_composers.append(unit_composer)
            next_unit_id += 1

        m4_module = {
            "$type": "Module",
            "Name": "AQL-GV-M4",
            "DriverGuid": "80000000-0000-0000-0000-000000000016",
            "Guid": m4_module_guid,
            "IpAddress": project_info.get('m4_ip'),
            "HsnetAddress": int(project_info.get('m4_hsnet', 245)),
            "PollTiming": 0,
            "Disabled": False,
            "RemotePort": 0,
            "RemoteIpAddress": None,
            "Notes": None,
            "Logicserver": True,
            "DevID": int(project_info.get('m4_devid', 1)),
            "DevIDSlave": 0,
            "UnitComposers": m4_unit_composers,  # Adicionando os UnitComposers
            "Slots": [
                {
                    "$type": "Slot",
                    "SlotCapacity": 24,
                    "SlotType": 0,
                    "InitialPort": 1,
                    "IO": 0,
                    "UnitComposers": None,
                    "SubItemsGuid": ["00000000-0000-0000-0000-000000000000"],
                    "Name": "ACNET",
                },
                {
                    "$type": "Slot",
                    "SlotCapacity": 96,
                    "SlotType": 8,
                    "InitialPort": 1,
                    "IO": 1,
                    "UnitComposers": None,
                    "SubItemsGuid": ["00000000-0000-0000-0000-000000000000"] * 96,
                    "Name": "Scene",
                },
            ],
            "SmartGroup": 1,
            "UserInterfaceGuid": "00000000-0000-0000-0000-000000000000",
            "PIRSensorReportEnable": False,
            "PIRSensorReportID": 0,
        }

        # SpecialActions padrão
        def default_special_actions():
            return [
                {"$type": "SpecialAction", "Name": "All HVAC",  "Guid": str(uuid.uuid4()), "Type": 4},
                {"$type": "SpecialAction", "Name": "All Lights","Guid": str(uuid.uuid4()), "Type": 2},
                {"$type": "SpecialAction", "Name": "All Shades","Guid": str(uuid.uuid4()), "Type": 3},
                {"$type": "SpecialAction", "Name": "OFF",       "Guid": str(uuid.uuid4()), "Type": 0},
                {"$type": "SpecialAction", "Name": "Volume",    "Guid": str(uuid.uuid4()), "Type": 1},
            ]

        startup_var = {
            "$type": "Variable",
            "Name": "Startup",
            "Description": "This variable indicates that the system has just been booted.",
            "Guid": str(uuid.uuid4()),
            "Configurable": False,
            "Memorizable": False,
            "IsStartup": True,
            "AllowsModify": False,
            "VariableType": 0,
            "NumericSubType": 0,
            "InitialValue": 0,
            "Id": 1,
        }

        # Montagem do projeto
        self.project_data = {
            "$type": "Project",
            "Areas": [
                {
                    "$type": "Area",
                    "Scenes": [],
                    "Scripts": [],
                    "Variables": [],
                    "SpecialActions": default_special_actions(),
                    "Guid": str(uuid.uuid4()),
                    "Name": project_info.get('tech_area', 'Área Técnica'),
                    "Notes": "",
                    "NotDisplayOnROEHNApp": False,
                    "SubItems": [
                        {
                            "$type": "Room",
                            "NotDisplayOnROEHNApp": False,
                            "Name": project_info.get('tech_room', 'Sala Técnica'),
                            "Notes": None,
                            "Scenes": [],
                            "Scripts": [],
                            "Variables": [],
                            "LoadOutputs": [],
                            "UserInterfaces": [],
                            "AutomationBoards": [
                                {
                                    "$type": "AutomationBoard",
                                    "Name": project_info.get('board_name', 'Quadro Elétrico'),
                                    "Notes": None,
                                    "ModulesList": [m4_module],
                                }
                            ],
                            "SpecialActions": default_special_actions(),
                            "Guid": str(uuid.uuid4()),
                        }
                    ],
                }
            ],
            "Scenes": [],
            "Scripts": [],
            "Variables": [startup_var],
            "SpecialActions": default_special_actions(),
            "SavedProfiles": None,
            "SavedControlModels": None,
            "ClientInfo": {
                "$type": "ClientInfo",
                "Name": project_info.get('client_name', 'Cliente'),
                "Email": project_info.get('client_email', ''),
                "Phone": project_info.get('client_phone', ''),
            },
            "Name": project_info.get('project_name', 'Novo Projeto'),
            "Path": None,
            "Guid": project_guid,
            "Created": now_iso,
            "LastModified": now_iso,
            "LastUpload": None,
            "LastTimeSaved": now_iso,
            "ProgrammerInfo": {
                "$type": "ProgrammerInfo",
                "Name": project_info.get('programmer_name', 'Programador'),
                "Email": project_info.get('programmer_email', ''),
                "Guid": project_info.get('programmer_guid', str(uuid.uuid4())),
            },
            "CloudConfig": {
                "$type": "CloudConfig",
                "CloudHomesystemsId": 0,
                "CloudSerialNumber": 0,
                "RemoteAcess": False,
                "CloudConfiguration": None,
                "CloudLocalName": None,
                "CloudPassword": None,
            },
            "ProjectSchemaVersion": 1,
            "SoftwareVersion": project_info.get('software_version', '1.0.8.67'),
            "SelectedTimeZoneID": project_info.get('timezone_id', 'America/Bahia'),
            "Latitude": float(project_info.get('lat', 0.0)),
            "Longitude": float(project_info.get('lon', 0.0)),
            "Notes": None,
            "RoehnAppExport": False,
        }
        
        return self.project_data

    def process_csv(self, csv_content):
        """Processa o conteúdo CSV e adiciona os circuitos ao projeto"""
        if not self.project_data:
            raise ValueError("Projeto não inicializado. Chame create_project primeiro.")
        
        # Converter conteúdo CSV para lista de dicionários
        csv_file = io.StringIO(csv_content)
        reader = csv.DictReader(csv_file)
        
        shades_seen = set()
        
        for row in reader:
            circuito = (row.get("Circuito") or "").strip()
            tipo = (row.get("Tipo") or "").strip().lower()
            nome = (row.get("Nome") or "").strip()
            area = (row.get("Area") or "").strip()
            ambiente = (row.get("Ambiente") or "").strip()
            canal = (row.get("Canal") or "").strip()
            modulo = (row.get("Modulo") or "").strip()
            id_modulo = (row.get("id Modulo") or row.get("id_modulo") or "").strip()

            if not area or not ambiente or not modulo or not id_modulo or not canal:
                continue
                
            try:
                canal = int(canal)
            except ValueError:
                continue

            self._ensure_area_exists(area)
            self._ensure_room_exists(area, ambiente)
            # Para CSV, ainda usamos o formato antigo para compatibilidade
            modulo_nome = self._ensure_module_exists(modulo, f"{modulo}_{id_modulo}")

            if tipo == "luz":
                # ⭐⭐⭐ NOVO: Tentar obter informação de dimerizável do CSV (se existir)
                dimerizavel_csv = row.get("Dimerizavel", "").strip().lower()
                dimerizavel = dimerizavel_csv in ["sim", "true", "1", "yes"]
                
                guid = self._add_load(area, ambiente, nome or circuito or "Load", dimerizavel=dimerizavel)
                self._link_load_to_module(guid, modulo_nome, canal, dimerizavel=dimerizavel)
            elif tipo == "persiana":
                key = f"{area}|{ambiente}|{nome or circuito or 'Persiana'}"
                if key not in shades_seen:
                    guid = self._add_shade(area, ambiente, nome or circuito or "Persiana")
                    self._link_shade_to_module(guid, modulo_nome, canal)
                    shades_seen.add(key)
            elif tipo == "hvac":
                guid = self._add_hvac(area, ambiente, nome or "Ar-Condicionado")
                self._link_hvac_to_module(guid, modulo_nome, canal)
        
        return self.project_data

    def _ensure_area_exists(self, area_name):
        """Garante que uma área existe no projeto Roehn"""
        for area in self.project_data["Areas"]:
            if area["Name"] == area_name:
                return area
        
        # Se a área não existe, cria uma nova
        new_area = {
            "$type": "Area",
            "Scenes": [],
            "Scripts": [],
            "Variables": [],
            "SpecialActions": [
                {"$type": "SpecialAction", "Name": "All HVAC", "Guid": str(uuid.uuid4()), "Type": 4},
                {"$type": "SpecialAction", "Name": "All Lights", "Guid": str(uuid.uuid4()), "Type": 2},
                {"$type": "SpecialAction", "Name": "All Shades", "Guid": str(uuid.uuid4()), "Type": 3},
                {"$type": "SpecialAction", "Name": "OFF", "Guid": str(uuid.uuid4()), "Type": 0},
                {"$type": "SpecialAction", "Name": "Volume", "Guid": str(uuid.uuid4()), "Type": 1}
            ],
            "Guid": str(uuid.uuid4()),
            "Name": area_name,
            "Notes": "",
            "NotDisplayOnROEHNApp": False,
            "SubItems": []
        }
        self.project_data["Areas"].append(new_area)
        return new_area

    def _ensure_room_exists(self, area_name, room_name):
        """Garante que um ambiente existe em uma área"""
        area = self._ensure_area_exists(area_name)
        
        for room in area["SubItems"]:
            if room["Name"] == room_name:
                return room
        
        # Se o ambiente não existe, cria um novo
        new_room = {
            "$type": "Room",
            "NotDisplayOnROEHNApp": False,
            "Name": room_name,
            "Notes": None,
            "Scenes": [],
            "Scripts": [],
            "Variables": [],
            "LoadOutputs": [],
            "UserInterfaces": [],
            "AutomationBoards": [],
            "SpecialActions": [
                {"$type": "SpecialAction", "Name": "All HVAC", "Guid": str(uuid.uuid4()), "Type": 4},
                {"$type": "SpecialAction", "Name": "All Lights", "Guid": str(uuid.uuid4()), "Type": 2},
                {"$type": "SpecialAction", "Name": "All Shades", "Guid": str(uuid.uuid4()), "Type": 3},
                {"$type": "SpecialAction", "Name": "OFF", "Guid": str(uuid.uuid4()), "Type": 0},
                {"$type": "SpecialAction", "Name": "Volume", "Guid": str(uuid.uuid4()), "Type": 1}
            ],
            "Guid": str(uuid.uuid4())
        }
        area["SubItems"].append(new_room)
        return new_room

    def _ensure_module_exists(self, model, module_name=None):
        """Garantir que um modulo existe no projeto Roehn."""
        modules_list = self.project_data["Areas"][0]["SubItems"][0]["AutomationBoards"][0]["ModulesList"]

        modulo_obj = None
        desired_hsnet = None
        desired_dev_id = None

        if hasattr(model, "nome") and hasattr(model, "tipo"):
            modulo_obj = model
            module_name = modulo_obj.nome
            model_key = (modulo_obj.tipo or "").upper()
            desired_hsnet = modulo_obj.hsnet
            desired_dev_id = modulo_obj.dev_id
        else:
            model_key = (model or "").upper()
            if module_name is None:
                module_name = model_key

        if not module_name:
            module_name = "Modulo"

        for module in modules_list:
            if module.get("Name") == module_name:
                if modulo_obj:
                    if desired_hsnet is not None:
                        module["HsnetAddress"] = desired_hsnet
                    if desired_dev_id is not None:
                        module["DevID"] = desired_dev_id
                return module_name

        if desired_hsnet is not None and not self._is_hsnet_duplicate(desired_hsnet):
            hsnet = desired_hsnet
        else:
            hsnet = self._find_max_hsnet() + 1
            while self._is_hsnet_duplicate(hsnet):
                hsnet += 1

        if desired_dev_id is not None:
            dev_id = desired_dev_id
        else:
            dev_id = self._find_max_dev_id() + 1

        key = (model_key or module_name).upper()
        if "RL12" in key:
            self._create_rl12_module(module_name, hsnet, dev_id)
        elif "RL4" in key:
            self._create_rl4_module(module_name, hsnet, dev_id)
        elif "LX4" in key:
            self._create_lx4_module(module_name, hsnet, dev_id)
        elif "SA1" in key:
            self._create_sa1_module(module_name, hsnet, dev_id)
        elif "DIM8" in key or "ADP-DIM8" in key:
            self._create_dim8_module(module_name, hsnet, dev_id)
        else:
            self._create_rl12_module(module_name, hsnet, dev_id)

        return module_name

    def _create_rl4_module(self, name, hsnet_address, dev_id):
        """Cria um módulo RL4"""
        new_module_guid = str(uuid.uuid4())
        new_module = {
            "$type": "Module",
            "Name": name,
            "DriverGuid": "80000000-0000-0000-0000-000000000010",
            "Guid": new_module_guid,
            "IpAddress": "",
            "HsnetAddress": hsnet_address,
            "PollTiming": 0,
            "Disabled": False,
            "RemotePort": 0,
            "RemoteIpAddress": "",
            "Notes": None,
            "Logicserver": False,
            "DevID": dev_id,
            "DevIDSlave": 0,
            "UnitComposers": None,
            "Slots": [
                {
                    "$type": "Slot",
                    "SlotCapacity": 4,
                    "SlotType": 1,
                    "InitialPort": 1,
                    "IO": 1,
                    "UnitComposers": None,
                    "SubItemsGuid": ["00000000-0000-0000-0000-000000000000"] * 4,
                    "Name": "Load ON/OFF"
                }
            ],
            "SmartGroup": 1,
            "UserInterfaceGuid": "00000000-0000-0000-0000-000000000000",
            "PIRSensorReportEnable": False,
            "PIRSensorReportID": 0
        }
        self._add_module_to_project(new_module, new_module_guid)

    def _create_lx4_module(self, name, hsnet_address, dev_id):
        """Cria um módulo LX4"""
        next_unit_id = self._find_max_unit_id() + 1
        unit_composers = []
        for i in range(4):
            for j in range(4):
                unit_composers.append({
                    "$type": "UnitComposer",
                    "Name": f"Opening Percentage {i+1} {j+1}",
                    "Unit": {
                        "$type": "Unit",
                        "Id": next_unit_id,
                        "Event": 0,
                        "Scene": 0,
                        "Disabled": False,
                        "Logged": False,
                        "Memo": False,
                        "Increment": False
                    },
                    "PortNumber": 1 if j % 2 == 0 else 5,
                    "PortType": 6,
                    "NotProgrammable": False,
                    "Kind": 1,
                    "IO": 1 if j % 2 == 0 else 0,
                    "Value": 0
                })
                next_unit_id += 1

        new_module_guid = str(uuid.uuid4())
        new_module = {
            "$type": "Module",
            "Name": name,
            "DriverGuid": "80000000-0000-0000-0000-000000000003",
            "Guid": new_module_guid,
            "IpAddress": "",
            "HsnetAddress": hsnet_address,
            "PollTiming": 0,
            "Disabled": False,
            "RemotePort": 0,
            "RemoteIpAddress": "",
            "Notes": None,
            "Logicserver": False,
            "DevID": dev_id,
            "DevIDSlave": 0,
            "UnitComposers": unit_composers,
            "Slots": [
                {
                    "$type": "Slot",
                    "SlotCapacity": 4,
                    "SlotType": 7,
                    "InitialPort": 1,
                    "IO": 1,
                    "UnitComposers": None,
                    "SubItemsGuid": ["00000000-0000-0000-0000-000000000000"] * 4,
                    "Name": "Shade"
                },
                {
                    "$type": "Slot",
                    "SlotCapacity": 6,
                    "SlotType": 6,
                    "InitialPort": 1,
                    "IO": 0,
                    "UnitComposers": None,
                    "SubItemsGuid": ["00000000-0000-0000-0000-000000000000"] * 6,
                    "Name": "PNET"
                }
            ],
            "SmartGroup": 1,
            "UserInterfaceGuid": "00000000-0000-0000-0000-000000000000",
            "PIRSensorReportEnable": False,
            "PIRSensorReportID": 0
        }
        self._add_module_to_project(new_module, new_module_guid)

    def _create_sa1_module(self, name, hsnet_address, dev_id):
        """Cria um módulo SA1"""
        next_unit_id = self._find_max_unit_id() + 1
        unit_composers = []
        composers_data = [
            {"Name": "Power", "PortNumber": 1, "PortType": 600, "NotProgrammable": False, "Kind": 1, "IO": 1},
            {"Name": "Mode", "PortNumber": 2, "PortType": 600, "NotProgrammable": False, "Kind": 1, "IO": 1},
            {"Name": "Fan Speed", "PortNumber": 4, "PortType": 600, "NotProgrammable": False, "Kind": 1, "IO": 1},
            {"Name": "Swing", "PortNumber": 5, "PortType": 600, "NotProgrammable": False, "Kind": 1, "IO": 1},
            {"Name": "Temp Up", "PortNumber": 11, "PortType": 600, "NotProgrammable": False, "Kind": 1, "IO": 1},
            {"Name": "Temp Down", "PortNumber": 12, "PortType": 600, "NotProgrammable": False, "Kind": 1, "IO": 1},
            {"Name": "Display/Light", "PortNumber": 3, "PortType": 100, "NotProgrammable": False, "Kind": 0, "IO": 1},
        ]
        for composer in composers_data:
            unit_composers.append({
                "$type": "UnitComposer",
                "Name": composer["Name"],
                "Unit": {
                    "$type": "Unit",
                    "Id": next_unit_id,
                    "Event": 0,
                    "Scene": 0,
                    "Disabled": False,
                    "Logged": False,
                    "Memo": False,
                    "Increment": False
                },
                "PortNumber": composer["PortNumber"],
                "PortType": composer["PortType"],
                "NotProgrammable": composer["NotProgrammable"],
                "Kind": composer["Kind"],
                "IO": composer["IO"],
                "Value": 0
            })
            next_unit_id += 1

        new_module_guid = str(uuid.uuid4())
        new_module = {
            "$type": "ModuleHVAC",
            "SubItemComposers": [unit_composers],
            "GTWItemComposers": [],
            "Name": name,
            "DriverGuid": "80000000-0000-0000-0000-000000000013",
            "Guid": new_module_guid,
            "IpAddress": "",
            "HsnetAddress": hsnet_address,
            "PollTiming": 0,
            "Disabled": False,
            "RemotePort": 0,
            "RemoteIpAddress": "",
            "Notes": None,
            "Logicserver": False,
            "DevID": dev_id,
            "DevIDSlave": 0,
            "Slots": [
                {
                    "$type": "Slot",
                    "SlotCapacity": 1,
                    "SlotType": 4,
                    "InitialPort": 1,
                    "IO": 1,
                    "UnitComposers": None,
                    "SubItemsGuid": ["00000000-0000-0000-0000-000000000000"],
                    "Name": "IR"
                }
            ],
            "SmartGroup": 1,
            "UserInterfaceGuid": "00000000-0000-0000-0000-000000000000",
            "PIRSensorReportEnable": False,
            "PIRSensorReportID": 0
        }

        self._add_module_to_project(new_module, new_module_guid)

    def _create_dim8_module(self, name, hsnet_address, dev_id):
        """Cria um módulo DIM8"""
        new_module_guid = str(uuid.uuid4())
        zero = "00000000-0000-0000-0000-000000000000"

        new_module = {
            "$type": "Module",
            "Name": name,
            "DriverGuid": "80000000-0000-0000-0000-000000000001",
            "Guid": new_module_guid,
            "IpAddress": "",
            "HsnetAddress": hsnet_address,
            "PollTiming": 0,
            "Disabled": False,
            "RemotePort": 0,
            "RemoteIpAddress": "",
            "Notes": None,
            "Logicserver": False,
            "DevID": dev_id,
            "DevIDSlave": 0,
            "UnitComposers": None,
            "Slots": [
                {
                    "$type": "Slot",
                    "SlotCapacity": 8,
                    "SlotType": 2,
                    "InitialPort": 1,
                    "IO": 1,
                    "UnitComposers": None,
                    "SubItemsGuid": [zero] * 8,
                    "Name": "Load Dim"
                },
                {
                    "$type": "Slot",
                    "SlotCapacity": 6,
                    "SlotType": 6,
                    "InitialPort": 1,
                    "IO": 1,
                    "UnitComposers": None,
                    "SubItemsGuid": [zero] * 6,
                    "Name": "PNET"
                }
            ],
            "SmartGroup": 1,
            "UserInterfaceGuid": "00000000-0000-0000-0000-000000000000",
            "PIRSensorReportEnable": False,
            "PIRSensorReportID": 0
        }

        self._add_module_to_project(new_module, new_module_guid)

    def _create_rl12_module(self, name, hsnet_address, dev_id):
        """Cria um módulo RL12"""
        new_module_guid = str(uuid.uuid4())
        new_module = {
            "$type": "Module",
            "Name": name,
            "DriverGuid": "80000000-0000-0000-0000-000000000006",
            "Guid": new_module_guid,
            "IpAddress": "",
            "HsnetAddress": hsnet_address,
            "PollTiming": 0,
            "Disabled": False,
            "RemotePort": 0,
            "RemoteIpAddress": "",
            "Notes": None,
            "Logicserver": False,
            "DevID": dev_id,
            "DevIDSlave": 0,
            "UnitComposers": None,
            "Slots": [
                {
                    "$type": "Slot",
                    "SlotCapacity": 12,
                    "SlotType": 1,
                    "InitialPort": 1,
                    "IO": 1,
                    "UnitComposers": None,
                    "SubItemsGuid": ["00000000-0000-0000-0000-000000000000"] * 12,
                    "Name": "Load ON/OFF"
                },
                {
                    "$type": "Slot",
                    "SlotCapacity": 6,
                    "SlotType": 6,
                    "InitialPort": 1,
                    "IO": 1,
                    "UnitComposers": None,
                    "SubItemsGuid": ["00000000-0000-0000-0000-000000000000"] * 6,
                    "Name": "PNET"
                }
            ],
            "SmartGroup": 1,
            "UserInterfaceGuid": "00000000-0000-0000-0000-000000000000",
            "PIRSensorReportEnable": False,
            "PIRSensorReportID": 0
        }
        self._add_module_to_project(new_module, new_module_guid)

    # Implementar métodos similares para outros tipos de módulos:
    # _create_rl4_module, _create_lx4_module, _create_sa1_module, _create_dim8_module

    def _add_module_to_project(self, new_module, new_module_guid):
        """Adiciona um módulo ao projeto e atualiza o ACNET"""
        modules_list = self.project_data["Areas"][0]["SubItems"][0]["AutomationBoards"][0]["ModulesList"]
        modules_list.append(new_module)

        # Atualizar o ACNET do módulo M4
        if modules_list:
            first_module = modules_list[0]  # O M4 é o primeiro módulo
            for slot in first_module.get("Slots", []):
                if slot.get("Name") == "ACNET":
                    # Encontrar a primeira posição vazia e substituir pelo novo GUID
                    for i, guid in enumerate(slot["SubItemsGuid"]):
                        if guid == "00000000-0000-0000-0000-000000000000":
                            slot["SubItemsGuid"][i] = new_module_guid
                            break
                    else:
                        # Se não encontrou posição vazia, adiciona ao final
                        slot["SubItemsGuid"].append(new_module_guid)
                    
                    # Garantir que há pelo menos um item vazio no final
                    if slot["SubItemsGuid"][-1] != "00000000-0000-0000-0000-000000000000":
                        slot["SubItemsGuid"].append("00000000-0000-0000-0000-000000000000")
                    
                    break

    def _add_keypads_for_room(self, area_name, ambiente):
        keypads = getattr(ambiente, "keypads", None)
        if not keypads:
            return

        try:
            area_idx = next(i for i, area in enumerate(self.project_data["Areas"]) if area.get("Name") == area_name)
        except StopIteration:
            return

        subitems = self.project_data["Areas"][area_idx].get("SubItems", [])
        try:
            room_idx = next(i for i, room in enumerate(subitems) if room.get("Name") == ambiente.nome)
        except StopIteration:
            return

        room = subitems[room_idx]
        user_interfaces = room.setdefault("UserInterfaces", [])
        for keypad in keypads:
            payload = self._build_keypad_payload(area_idx, room_idx, keypad)
            user_interfaces.append(payload)
            self._register_user_interface_guid(payload["Guid"])

    def _build_keypad_payload(self, area_idx, room_idx, keypad):
        zero_guid = self.zero_guid
        keypad_guid = str(uuid.uuid4())

        base_unit_id = self._find_max_unit_id() + 1

        def next_unit_id():
            nonlocal base_unit_id
            unit_id = base_unit_id
            base_unit_id += 1
            return unit_id

        def make_unit(unit_id):
            return {
                "$type": "Unit",
                "Id": unit_id,
                "Event": 0,
                "Scene": 0,
                "Disabled": False,
                "Logged": False,
                "Memo": False,
                "Increment": False,
            }

        def make_composer(name, port_number, port_type, kind, io):
            return {
                "$type": "UnitComposer",
                "Name": name,
                "Unit": make_unit(next_unit_id()),
                "PortNumber": port_number,
                "PortType": port_type,
                "NotProgrammable": False,
                "Kind": kind,
                "IO": io,
                "Value": 0,
            }

        color_value = (keypad.color or "WHITE").upper()
        button_color_value = (keypad.button_color or "WHITE").upper()
        button_count = int(keypad.button_count or len(keypad.buttons) or 1)
        button_layout = self.keypad_button_layouts.get(button_count, button_count)
        hsnet_address = keypad.hsnet if keypad.hsnet is not None else 0
        dev_id = keypad.dev_id if keypad.dev_id is not None else hsnet_address

        payload = {
            "$type": "Keypad",
            "DriverGuid": self.keypad_driver_guid,
            "ModuleInterface": False,
            "Keypad4x4": False,
            "HsnetAddress": hsnet_address,
            "TipoEntrada1ChaveLD": 0,
            "TipoEntrada2ChaveLD": 0,
            "UnitEntradaDigital1": make_composer("UnitEntradaDigital1", 1, 0, 0, 0),
            "UnitEntradaDigital2": make_composer("UnitEntradaDigital2", 2, 0, 0, 0),
            "UnitAnyKey": make_composer("UnitAnyKey", 3, 0, 0, 0),
            "BrightUnit": 0,
            "UnitBrightnessColor1": make_composer("UnitBrightnessColor1", 1, 600, 1, 1),
            "UnitBrightnessColor2": make_composer("UnitBrightnessColor2", 2, 600, 1, 1),
            "UnitBeepProfile": make_composer("UnitBeepProfile", 3, 600, 1, 1),
            "UnitVolumeProfile": make_composer("UnitVolumeProfile", 4, 600, 1, 1),
            "UnitVolumeKey": make_composer("UnitVolumeKey", 5, 0, 0, 0),
            "UnitBlockedKeypad": make_composer("UnitBlockedKeypad", 1, 100, 0, 1),
            "UnitPIN32": make_composer("UnitPIN32", 1, 1100, 1, 0),
            "NightModeGroup": 0,
            "LightSensorMode": 0,
            "LightSensorMasterID": 0,
            "DevID": dev_id,
            "ListKeypadButtons": [],
            "ListKeypadButtonsLayout2": [],
            "ProfileGuid": self.keypad_profile_guid,
            "ButtonCountLayout2": 0,
            "ButtonLayout2": 0,
            "Slots": [],
            "hold": 0,
            "ButtonLayout1": button_layout,
            "ModelName": keypad.modelo or "RQR-K",
            "Color": color_value,
            "ButtonColor": button_color_value,
            "Name": keypad.nome or "RQR-K",
            "Notes": keypad.notes,
            "Guid": keypad_guid,
            "ButtonCount": button_count,
        }

        primary_ports = [1, 2, 3, 4]
        secondary_ports = [5, 6, 7, 8]

        for button in sorted(keypad.buttons, key=lambda b: b.ordem or 0):
            if button.ordem and button.ordem > button_count:
                continue
            index = (button.ordem - 1) if button.ordem else 0
            primary_port = primary_ports[index % len(primary_ports)]
            secondary_port = secondary_ports[index % len(secondary_ports)]

            unit_key = make_composer("UnitKey", primary_port, 300, 0, 0)
            unit_led = make_composer("UnitLed", primary_port, 200, 1, 1)
            unit_secondary_key = make_composer("UnitSecondaryKey", secondary_port, 300, 0, 0)
            unit_secondary_led = make_composer("UnitSecondaryLed", secondary_port, 200, 1, 1)

            target_guid = zero_guid
            circuito = button.circuito
            if circuito and circuito.id in self._circuit_guid_map:
                target_guid = self._circuit_guid_map[circuito.id]

            style_properties = None
            if target_guid != zero_guid:
                style_properties = {
                    "$type": "Dictionary`2",
                    "STYLE_PROP_ICON": None,
                    "STYLE_PROP_ROCKER_ICON": self.keypad_rocker_icon_guid,
                }

            button_payload = {
                "$type": "RockerKeypadButton",
                "StylePropertiesSerializable": style_properties,
                "DoublePressDelay": False,
                "TargetDoubleObjectGuid": zero_guid,
                "ModoDoublePress": button.modo_double_press or 3,
                "CommandDoublePress": button.command_double_press or 0,
                "PortNumberDoublePress": 0,
                "CanHold": bool(button.can_hold),
                "Guid": button.guid or str(uuid.uuid4()),
                "TargetObjectGuid": target_guid,
                "Modo": button.modo or (2 if target_guid != zero_guid else 3),
                "CommandOn": button.command_on if button.command_on is not None else (1 if target_guid != zero_guid else 0),
                "CommandOff": button.command_off if button.command_off is not None else 0,
                "PortNumber": 0,
                "UnitControleLed": 0,
                "LedColor": 0,
                "Vincled": False,
                "TimeFeedBack": 0,
                "UnitKey": unit_key,
                "UnitLed": unit_led,
                "UnitSecondaryKey": unit_secondary_key,
                "UnitSecondaryLed": unit_secondary_led,
                "ButtonStyleGuid": zero_guid,
                "EngraverText": button.notes,
                "Automode": True,
            }
            payload["ListKeypadButtons"].append(button_payload)

        return payload

    def _register_user_interface_guid(self, ui_guid):
        try:
            modules_list = self.project_data["Areas"][0]["SubItems"][0]["AutomationBoards"][0]["ModulesList"]
        except (KeyError, IndexError):
            return
        if not modules_list:
            return

        acnet_slot = None
        for slot in modules_list[0].get("Slots", []):
            if slot.get("Name") == "ACNET":
                acnet_slot = slot
                break
        if acnet_slot is None:
            return

        subitems = acnet_slot.setdefault("SubItemsGuid", [])
        if ui_guid in subitems:
            return

        for index, guid in enumerate(subitems):
            if guid == self.zero_guid:
                subitems[index] = ui_guid
                break
        else:
            subitems.append(ui_guid)

        if subitems and subitems[-1] != self.zero_guid:
            subitems.append(self.zero_guid)

    def _find_max_dev_id(self):
        """Encontra o maior DevID atual"""
        max_id = 0
        if not self.project_data:
            return max_id
            
        try:
            modules = self.project_data['Areas'][0]['SubItems'][0]['AutomationBoards'][0]['ModulesList']
            for module in modules:
                if 'DevID' in module and module['DevID'] > max_id:
                    max_id = module['DevID']
        except (KeyError, IndexError):
            pass
            
        return max_id

    def _find_max_hsnet(self):
        """Encontra o maior HSNET atual"""
        max_addr = 100
        if not self.project_data:
            return max_addr
            
        try:
            modules = self.project_data['Areas'][0]['SubItems'][0]['AutomationBoards'][0]['ModulesList']
            for module in modules:
                if 'HsnetAddress' in module and module['HsnetAddress'] > max_addr:
                    max_addr = module['HsnetAddress']
        except (KeyError, IndexError):
            pass

        try:
            user_interfaces = self.project_data['Areas'][0]['SubItems'][0].get('UserInterfaces', [])
            for ui in user_interfaces:
                if 'HsnetAddress' in ui and ui['HsnetAddress'] > max_addr:
                    max_addr = ui['HsnetAddress']
        except (KeyError, IndexError):
            pass

        return max_addr

    def _is_hsnet_duplicate(self, hsnet_address):
        """Verifica se um endereço HSNET já está em uso"""
        if not self.project_data:
            return False
            
        try:
            modules = self.project_data['Areas'][0]['SubItems'][0]['AutomationBoards'][0]['ModulesList']
            for module in modules:
                if 'HsnetAddress' in module and module['HsnetAddress'] == hsnet_address:
                    return True
        except (KeyError, IndexError):
            pass

        try:
            user_interfaces = self.project_data['Areas'][0]['SubItems'][0].get('UserInterfaces', [])
            for ui in user_interfaces:
                if 'HsnetAddress' in ui and ui['HsnetAddress'] == hsnet_address:
                    return True
        except (KeyError, IndexError):
            pass

        return False

    def _add_shade(self, area, ambiente, name, description="Persiana"):
        """Adiciona uma persiana ao projeto"""
        area_idx = next(i for i, a in enumerate(self.project_data["Areas"]) if a["Name"] == area)
        room_idx = next(i for i, r in enumerate(self.project_data["Areas"][area_idx]["SubItems"]) if r["Name"] == ambiente)

        next_unit_id = self._find_max_unit_id() + 1

        new_shade = {
            "$type": "Shade",
            "ShadeType": 0,
            "ShadeIcon": 0,
            "ProfileGuid": "20000000-0000-0000-0000-000000000001",
            "UnitMovement": {
                "$type": "Unit",
                "Id": next_unit_id,
                "Event": 0,
                "Scene": 0,
                "Disabled": False,
                "Logged": False,
                "Memo": False,
                "Increment": False
            },
            "UnitOpenedPercentage": {
                "$type": "Unit",
                "Id": next_unit_id + 1,
                "Event": 0,
                "Scene": 0,
                "Disabled": False,
                "Logged": False,
                "Memo": False,
                "Increment": False
            },
            "UnitCurrentPosition": {
                "$type": "Unit",
                "Id": next_unit_id + 2,
                "Event": 0,
                "Scene": 0,
                "Disabled": False,
                "Logged": False,
                "Memo": False,
                "Increment": False
            },
            "Name": name,
            "Guid": str(uuid.uuid4()),
            "Description": description
        }
        self.project_data["Areas"][area_idx]["SubItems"][room_idx]["LoadOutputs"].append(new_shade)
        return new_shade["Guid"]

    def _add_hvac(self, area, ambiente, name, description="HVAC"):
        """Adiciona um HVAC ao projeto"""
        area_idx = next(i for i, a in enumerate(self.project_data["Areas"]) if a["Name"] == area)
        room_idx = next(i for i, r in enumerate(self.project_data["Areas"][area_idx]["SubItems"]) if r["Name"] == ambiente)

        new_hvac = {
            "$type": "HVAC",
            "ProfileGuid": "14000000-0000-0000-0000-000000000001",
            "ControlModelGuid": "17000000-0000-0000-0000-000000000001",
            "Unit": None,
            "Name": name,
            "Guid": str(uuid.uuid4()),
            "Description": description
        }

        self.project_data["Areas"][area_idx]["SubItems"][room_idx]["LoadOutputs"].append(new_hvac)
        return new_hvac["Guid"]

    def _link_shade_to_module(self, shade_guid, module_name, canal):
        """Vincula uma persiana a um módulo"""
        try:
            modules_list = self.project_data['Areas'][0]['SubItems'][0]['AutomationBoards'][0]['ModulesList']
            for module in modules_list:
                if module['Name'] == module_name:
                    for slot in module['Slots']:
                        if slot['Name'] == 'Shade':
                            while len(slot['SubItemsGuid']) < slot['SlotCapacity']:
                                slot['SubItemsGuid'].append("00000000-0000-0000-0000-000000000000")
                            slot['SubItemsGuid'][canal-1] = shade_guid
                            return True
        except Exception as e:
            print("Erro ao linkar persiana:", e)
        return False

    def _link_hvac_to_module(self, hvac_guid, module_name, canal):
        """Vincula um HVAC a um módulo"""
        try:
            modules_list = self.project_data['Areas'][0]['SubItems'][0]['AutomationBoards'][0]['ModulesList']
            for module in modules_list:
                if module['Name'] == module_name:
                    for slot in module['Slots']:
                        if slot['Name'] == 'IR':
                            while len(slot['SubItemsGuid']) < slot['SlotCapacity']:
                                slot['SubItemsGuid'].append("00000000-0000-0000-0000-000000000000")
                            slot['SubItemsGuid'][canal-1] = hvac_guid
                            return True
        except Exception as e:
            print("Erro ao linkar HVAC:", e)
        return False

    def _add_load(self, area, ambiente, name, power=0.0, description="ON/OFF", dimerizavel=False):
        """Adiciona um circuito de iluminação"""
        area_idx = next(i for i, a in enumerate(self.project_data["Areas"]) if a["Name"] == area)
        room_idx = next(i for i, r in enumerate(self.project_data["Areas"][area_idx]["SubItems"]) if r["Name"] == ambiente)

        next_unit_id = self._find_max_unit_id() + 1

        # ⭐⭐⭐ NOVO: Determinar LoadType e ProfileGuid baseado em dimerizavel
        if dimerizavel:
            load_type = 2  # Reverse Phase Dimmer
            profile_guid = "10000000-0000-0000-0000-000000000002"  # GUID para dimer
            description = "Dimmer"
        else:
            load_type = 0  # ON/OFF
            profile_guid = "10000000-0000-0000-0000-000000000001"  # GUID para ON/OFF
            description = "ON/OFF"

        new_load = {
            "$type": "Circuit",
            "LoadType": load_type,  # ⭐⭐⭐ MODIFICADO
            "IconPath": 0,
            "Power": power,
            "ProfileGuid": profile_guid,  # ⭐⭐⭐ MODIFICADO
            "Unit": {
                "$type": "Unit",
                "Id": next_unit_id,
                "Event": 0,
                "Scene": 0,
                "Disabled": False,
                "Logged": False,
                "Memo": False,
                "Increment": False
            },
            "Name": name,
            "Guid": str(uuid.uuid4()),
            "Description": description
        }
        self.project_data["Areas"][area_idx]["SubItems"][room_idx]["LoadOutputs"].append(new_load)
        return new_load["Guid"]

    def _find_max_unit_id(self):
        """Encontra o maior Unit ID atual, considerando UnitComposers"""
        max_id = 0
        
        def find_ids(data):
            nonlocal max_id
            if isinstance(data, dict):
                if data.get("$type") == "Unit" and "Id" in data:
                    max_id = max(max_id, data["Id"])
                # Também procurar em UnitComposers
                if "UnitComposers" in data and isinstance(data["UnitComposers"], list):
                    for composer in data["UnitComposers"]:
                        if isinstance(composer, dict) and "Unit" in composer:
                            unit = composer["Unit"]
                            if isinstance(unit, dict) and "Id" in unit:
                                max_id = max(max_id, unit["Id"])
                for value in data.values():
                    find_ids(value)
            elif isinstance(data, list):
                for item in data:
                    find_ids(item)
        
        find_ids(self.project_data)
        return max_id

    def _link_load_to_module(self, load_guid, module_name, canal, dimerizavel=False):
        """Vincula um circuito de iluminação a um módulo"""
        try:
            modules_list = self.project_data['Areas'][0]['SubItems'][0]['AutomationBoards'][0]['ModulesList']
            for module in modules_list:
                if module['Name'] == module_name:
                    # ⭐⭐⭐ NOVO: Priorizar slots baseado no tipo de carga
                    if dimerizavel:
                        # Para dimerizável, tentar primeiro Load Dim, depois Load ON/OFF
                        slot_priority = ['Load Dim', 'Load ON/OFF']
                    else:
                        # Para ON/OFF, tentar primeiro Load ON/OFF, depois Load Dim
                        slot_priority = ['Load ON/OFF', 'Load Dim']
                    
                    for wanted_slot in slot_priority:
                        for slot in module.get('Slots', []):
                            if slot.get('Name') == wanted_slot:
                                while len(slot['SubItemsGuid']) < slot.get('SlotCapacity', 0):
                                    slot['SubItemsGuid'].append("00000000-0000-0000-0000-000000000000")
                                slot['SubItemsGuid'][canal-1] = load_guid
                                print(f"Circuito vinculado ao slot: {wanted_slot}, canal: {canal}")
                                return True
                    break
        except Exception as e:
            print("Erro ao linkar load:", e)
        return False

    # Implementar métodos similares para:
    # _add_shade, _add_hvac, _link_shade_to_module, _link_hvac_to_module

    def export_project(self):
        """Exporta o projeto como JSON (formato Roehn Wizard)"""
        if not self.project_data:
            raise ValueError("Nenhum projeto para exportar")
            
        return json.dumps(self.project_data, indent=2, ensure_ascii=False)