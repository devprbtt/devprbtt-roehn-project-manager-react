# roehn_converter_standalone.py
import json
import uuid
from datetime import datetime

class RoehnStandaloneConverter:
    def __init__(self):
        self.zero_guid = "00000000-0000-0000-0000-000000000000"
        self.keypad_driver_guid = "90000000-0000-0000-0000-000000000004"
        self.keypad_profile_guid = "40000000-0000-0000-0000-000000000001"
        
        # Mapeamento de tipos de módulos
        self.modules_info = {
            'ADP-RL12': {'driver_guid': '80000000-0000-0000-0000-000000000006', 'slots': {'Load ON/OFF': 12}},
            'RL4': {'driver_guid': '80000000-0000-0000-0000-000000000010', 'slots': {'Load ON/OFF': 4}},
            'LX4': {'driver_guid': '80000000-0000-0000-0000-000000000003', 'slots': {'Shade': 4}},
            'SA1': {'driver_guid': '80000000-0000-0000-0000-000000000013', 'slots': {'IR': 1}},
            'DIM8': {'driver_guid': '80000000-0000-0000-0000-000000000001', 'slots': {'Load Dim': 8}},
            'AQL-GV-M4': {'driver_guid': '80000000-0000-0000-0000-000000000016', 'slots': {'ACNET/RNET': 24, 'Scene': 96}},
            'ADP-M8': {'driver_guid': '80000000-0000-0000-0000-000000000018', 'slots': {'ACNET/RNET': 250, 'Scene': 256}},
            'ADP-M16': {'driver_guid': '80000000-0000-0000-0000-000000000004', 'slots': {'ACNET/RNET': 250, 'Scene': 256}}
        }
        
        # Ícones para keypads
        self.icon_guids = {
            "abajour": "11000000-0000-0000-0000-000000000026",
            "arandela": "11000000-0000-0000-0000-000000000028",
            "bright": "11000000-0000-0000-0000-000000000019",
            "cascata": "11000000-0000-0000-0000-000000000054",
            "churrasco": "11000000-0000-0000-0000-000000000057",
            "clean room": "11000000-0000-0000-0000-000000000045",
            "concierge": "11000000-0000-0000-0000-000000000046",
            "curtains": "11000000-0000-0000-0000-000000000036",
            "curtains preset 1": "11000000-0000-0000-0000-000000000038",
            "curtains preset 2": "11000000-0000-0000-0000-000000000037",
            "day": "11000000-0000-0000-0000-000000000013",
            "dim penumbra": "11000000-0000-0000-0000-000000000021",
            "dinner": "11000000-0000-0000-0000-000000000010",
            "do not disturb": "11000000-0000-0000-0000-000000000044",
            "door": "11000000-0000-0000-0000-000000000049",
            "doorbell": "11000000-0000-0000-0000-000000000043",
            "fan": "11000000-0000-0000-0000-000000000005",
            "fireplace": "11000000-0000-0000-0000-000000000050",
            "garage": "11000000-0000-0000-0000-000000000059",
            "gate": "11000000-0000-0000-0000-000000000055",
            "good night": "11000000-0000-0000-0000-000000000015",
            "gym1": "11000000-0000-0000-0000-000000000063",
            "gym2": "11000000-0000-0000-0000-000000000064",
            "gym3": "11000000-0000-0000-0000-000000000065",
            "hvac": "11000000-0000-0000-0000-000000000004",
            "irrigação": "11000000-0000-0000-0000-000000000062",
            "jardim1": "11000000-0000-0000-0000-000000000052",
            "jardim2": "11000000-0000-0000-0000-000000000053",
            "lampada": "11000000-0000-0000-0000-000000000030",
            "laundry": "11000000-0000-0000-0000-000000000047",
            "leaving": "11000000-0000-0000-0000-000000000016",
            "light preset 1": "11000000-0000-0000-0000-000000000023",
            "light preset 2": "11000000-0000-0000-0000-000000000024",
            "lower shades": "11000000-0000-0000-0000-000000000032",
            "luminaria de piso": "11000000-0000-0000-0000-000000000027",
            "medium": "11000000-0000-0000-0000-000000000020",
            "meeting": "11000000-0000-0000-0000-000000000066",
            "movie": "11000000-0000-0000-0000-000000000008",
            "music": "11000000-0000-0000-0000-000000000018",
            "night": "11000000-0000-0000-0000-000000000014",
            "onoff": "11000000-0000-0000-0000-000000000017",
            "padlock": "11000000-0000-0000-0000-000000000048",
            "party": "11000000-0000-0000-0000-000000000011",
            "pendant": "11000000-0000-0000-0000-000000000025",
            "piscina 1": "11000000-0000-0000-0000-000000000058",
            "piscina 2": "11000000-0000-0000-0000-000000000061",
            "pizza": "11000000-0000-0000-0000-000000000056",
            "raise shades": "11000000-0000-0000-0000-000000000033",
            "reading": "11000000-0000-0000-0000-000000000007",
            "shades": "11000000-0000-0000-0000-000000000031",
            "shades preset 1": "11000000-0000-0000-0000-000000000034",
            "shades preset 2": "11000000-0000-0000-0000-000000000035",
            "spot": "11000000-0000-0000-0000-000000000029",
            "steam room": "11000000-0000-0000-0000-000000000067",
            "turned off": "11000000-0000-0000-0000-000000000022",
            "tv": "11000000-0000-0000-0000-000000000040",
            "volume": "11000000-0000-0000-0000-000000000041",
            "welcome": "11000000-0000-0000-0000-000000000006",
            "wine": "11000000-0000-0000-0000-000000000012",
        }
        
        self.project_data = None
        self.circuit_guid_map = {}
        self.room_guid_map = {}
        self.board_guid_map = {}
        self.module_guid_map = {}

    def create_base_project(self, project_info):
        """Cria a estrutura base do projeto Roehn"""
        project_guid = str(uuid.uuid4())
        now_iso = datetime.now().isoformat()
        
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

        # Montagem do projeto base
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
                                    "ModulesList": [],
                                    "Guid": str(uuid.uuid4())
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
            "SelectedTimeZoneID": project_info.get('timezone_id', 'America/Sao_Paulo'),
            "Latitude": float(project_info.get('lat', 0.0)),
            "Longitude": float(project_info.get('lon', 0.0)),
            "Notes": None,
            "RoehnAppExport": False,
        }
        
        return self.project_data

    def process_json_project(self, json_data):
        """Processa o JSON completo e gera o projeto RWP"""
        try:
            # Criar projeto base
            project_info = {
                'project_name': json_data.get('nome', 'Projeto Importado'),
                'client_name': json_data.get('client_info', {}).get('client_name', 'Cliente'),
                'client_email': json_data.get('client_info', {}).get('client_email', ''),
                'client_phone': json_data.get('client_info', {}).get('client_phone', ''),
                'programmer_name': json_data.get('programmer_info', {}).get('programmer_name', 'Programador'),
                'programmer_email': json_data.get('programmer_info', {}).get('programmer_email', ''),
                'programmer_guid': json_data.get('programmer_info', {}).get('programmer_guid', str(uuid.uuid4())),
                'software_version': json_data.get('software_version', '1.0.8.67'),
                'timezone_id': json_data.get('timezone_id', 'America/Sao_Paulo'),
                'lat': json_data.get('lat', 0.0),
                'lon': json_data.get('lon', 0.0),
                'tech_area': json_data.get('tech_area', 'Área Técnica'),
                'tech_room': json_data.get('tech_room', 'Sala Técnica'),
                'board_name': json_data.get('board_name', 'Quadro Principal')
            }
            
            self.create_base_project(project_info)
            
            # Processar estrutura do projeto
            self._process_areas(json_data.get('areas', []))
            self._process_modules(json_data.get('modulos', []))
            self._process_circuits_and_links(json_data.get('areas', []))
            self._process_keypads(json_data.get('areas', []))
            
            # Configurar controlador principal
            self._setup_main_controller(json_data.get('modulos', []))
            
            print("✅ Projeto RWP gerado com sucesso!")
            return self.project_data
            
        except Exception as e:
            print(f"❌ Erro ao processar projeto: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _process_areas(self, areas_data):
        """Processa áreas, ambientes e quadros elétricos"""
        for area_data in areas_data:
            area_name = area_data.get('nome')
            area_guid = str(uuid.uuid4())
            
            # Criar área
            new_area = {
                "$type": "Area",
                "Scenes": [],
                "Scripts": [],
                "Variables": [],
                "SpecialActions": self._get_default_special_actions(),
                "Guid": area_guid,
                "Name": area_name,
                "Notes": "",
                "NotDisplayOnROEHNApp": False,
                "SubItems": []
            }
            
            self.project_data["Areas"].append(new_area)
            
            # Processar ambientes
            for ambiente_data in area_data.get('ambientes', []):
                self._process_ambiente(new_area, ambiente_data)

    def _process_ambiente(self, area_json, ambiente_data):
        """Processa um ambiente específico"""
        ambiente_name = ambiente_data.get('nome')
        ambiente_guid = str(uuid.uuid4())
        self.room_guid_map[ambiente_data.get('id')] = ambiente_guid
        
        # Criar ambiente
        new_room = {
            "$type": "Room",
            "NotDisplayOnROEHNApp": False,
            "Name": ambiente_name,
            "Notes": None,
            "Scenes": [],
            "Scripts": [],
            "Variables": [],
            "LoadOutputs": [],
            "UserInterfaces": [],
            "AutomationBoards": [],
            "SpecialActions": self._get_default_special_actions(),
            "Guid": ambiente_guid
        }
        
        area_json["SubItems"].append(new_room)
        
        # Processar quadros elétricos
        for quadro_data in ambiente_data.get('quadros_eletricos', []):
            self._process_quadro(new_room, quadro_data)

    def _process_quadro(self, room_json, quadro_data):
        """Processa um quadro elétrico"""
        quadro_name = quadro_data.get('nome')
        quadro_guid = str(uuid.uuid4())
        self.board_guid_map[quadro_data.get('id')] = quadro_guid
        
        new_board = {
            "$type": "AutomationBoard",
            "Name": quadro_name,
            "Notes": None,
            "ModulesList": [],
            "Guid": quadro_guid
        }
        
        room_json.setdefault("AutomationBoards", []).append(new_board)

    def _process_modules(self, modules_data):
        """Processa todos os módulos do projeto"""
        # Primeiro, processar o controlador principal
        main_controller = next((m for m in modules_data if m.get('is_logic_server')), None)
        if main_controller:
            self._create_main_controller(main_controller)
        
        # Processar módulos filhos
        for module_data in modules_data:
            if not module_data.get('is_logic_server'):
                self._create_module(module_data)

    def _create_main_controller(self, controller_data):
        """Cria o controlador principal (Logic Server)"""
        controller_type = controller_data.get('tipo', 'AQL-GV-M4')
        controller_name = controller_data.get('nome')
        
        # Configurações baseadas no tipo de controlador
        controller_configs = {
            "AQL-GV-M4": {
                "DriverGuid": "80000000-0000-0000-0000-000000000016",
                "DevID": 1,
                "ACNET_SlotCapacity": 24,
                "Scene_SlotCapacity": 96,
            },
            "ADP-M8": {
                "DriverGuid": "80000000-0000-0000-0000-000000000018",
                "DevID": 3,
                "ACNET_SlotCapacity": 250,
                "Scene_SlotCapacity": 256,
            },
            "ADP-M16": {
                "DriverGuid": "80000000-0000-0000-0000-000000000004",
                "DevID": 5,
                "ACNET_SlotCapacity": 250,
                "Scene_SlotCapacity": 256,
            }
        }
        
        config = controller_configs.get(controller_type, controller_configs["AQL-GV-M4"])
        
        # Criar módulo controlador
        controller_module = {
            "$type": "Module",
            "Name": controller_name,
            "DriverGuid": config["DriverGuid"],
            "Guid": str(uuid.uuid4()),
            "IpAddress": controller_data.get('ip_address', '192.168.1.100'),
            "HsnetAddress": controller_data.get('hsnet', 245),
            "PollTiming": 0,
            "Disabled": False,
            "RemotePort": 0,
            "RemoteIpAddress": controller_data.get('ip_address', '192.168.1.100'),
            "Notes": None,
            "Logicserver": True,
            "DevID": config["DevID"],
            "DevIDSlave": 0,
            "UnitComposers": self._create_controller_unit_composers(),
            "Slots": [
                {
                    "$type": "Slot",
                    "SlotCapacity": config["ACNET_SlotCapacity"],
                    "SlotType": 0,
                    "InitialPort": 1,
                    "IO": 0,
                    "UnitComposers": None,
                    "SubItemsGuid": [self.zero_guid],
                    "Name": "ACNET/RNET",
                },
                {
                    "$type": "Slot",
                    "SlotCapacity": config["Scene_SlotCapacity"],
                    "SlotType": 8,
                    "InitialPort": 1,
                    "IO": 1,
                    "UnitComposers": None,
                    "SubItemsGuid": [self.zero_guid] * config["Scene_SlotCapacity"],
                    "Name": "Scene",
                },
            ],
            "SmartGroup": 1,
            "UserInterfaceGuid": self.zero_guid,
            "PIRSensorReportEnable": False,
            "PIRSensorReportID": 0,
        }
        
        # Adicionar ao quadro correto
        quadro_id = controller_data.get('quadro_eletrico_id')
        if quadro_id and quadro_id in self.board_guid_map:
            board_guid = self.board_guid_map[quadro_id]
            board = self._find_board_by_guid(board_guid)
            if board:
                board["ModulesList"].insert(0, controller_module)
        else:
            # Adicionar ao quadro padrão
            self.project_data["Areas"][0]["SubItems"][0]["AutomationBoards"][0]["ModulesList"].insert(0, controller_module)
        
        self.module_guid_map[controller_data.get('id')] = controller_module["Guid"]

    def _create_module(self, module_data):
        """Cria um módulo comum"""
        module_type = module_data.get('tipo')
        module_name = module_data.get('nome')
        
        if module_type not in self.modules_info:
            print(f"⚠️ Tipo de módulo desconhecido: {module_type}, usando ADP-RL12 como padrão")
            module_type = 'ADP-RL12'
        
        module_info = self.modules_info[module_type]
        module_guid = str(uuid.uuid4())
        
        # Configurações básicas do módulo
        new_module = {
            "$type": "Module",
            "Name": module_name,
            "DriverGuid": module_info['driver_guid'],
            "Guid": module_guid,
            "IpAddress": "",
            "HsnetAddress": module_data.get('hsnet', self._find_next_hsnet()),
            "PollTiming": 0,
            "Disabled": False,
            "RemotePort": 0,
            "RemoteIpAddress": "",
            "Notes": None,
            "Logicserver": False,
            "DevID": module_data.get('dev_id', self._find_next_dev_id()),
            "DevIDSlave": 0,
            "UnitComposers": None,
            "Slots": [],
            "SmartGroup": 1,
            "UserInterfaceGuid": self.zero_guid,
            "PIRSensorReportEnable": False,
            "PIRSensorReportID": 0,
        }
        
        # Adicionar slots baseados no tipo de módulo
        for slot_name, slot_capacity in module_info['slots'].items():
            slot_type = self._get_slot_type(slot_name)
            new_module["Slots"].append({
                "$type": "Slot",
                "SlotCapacity": slot_capacity,
                "SlotType": slot_type,
                "InitialPort": 1,
                "IO": 1,
                "UnitComposers": None,
                "SubItemsGuid": [self.zero_guid] * slot_capacity,
                "Name": slot_name
            })
        
        # Adicionar ao quadro correto
        quadro_id = module_data.get('quadro_eletrico_id')
        if quadro_id and quadro_id in self.board_guid_map:
            board_guid = self.board_guid_map[quadro_id]
            board = self._find_board_by_guid(board_guid)
            if board:
                board["ModulesList"].append(new_module)
        else:
            # Adicionar ao quadro padrão
            self.project_data["Areas"][0]["SubItems"][0]["AutomationBoards"][0]["ModulesList"].append(new_module)
        
        self.module_guid_map[module_data.get('id')] = module_guid
        return module_guid

    def _process_circuits_and_links(self, areas_data):
        """Processa circuitos e suas vinculações com módulos"""
        for area_data in areas_data:
            for ambiente_data in area_data.get('ambientes', []):
                for circuito_data in ambiente_data.get('circuitos', []):
                    self._create_circuit(area_data, ambiente_data, circuito_data)
                    
                    # Processar vinculação se existir
                    if 'vinculacao' in circuito_data:
                        self._link_circuit_to_module(circuito_data)

    def _create_circuit(self, area_data, ambiente_data, circuito_data):
        """Cria um circuito no projeto RWP"""
        circuit_type = circuito_data.get('tipo')
        circuit_name = circuito_data.get('nome', circuito_data.get('identificador'))
        circuit_guid = str(uuid.uuid4())
        
        # Encontrar o ambiente no projeto RWP
        area_name = area_data.get('nome')
        room_name = ambiente_data.get('nome')
        
        area_json = next((a for a in self.project_data["Areas"] if a["Name"] == area_name), None)
        if not area_json:
            return None
            
        room_json = next((r for r in area_json["SubItems"] if r["Name"] == room_name), None)
        if not room_json:
            return None
        
        # Criar circuito baseado no tipo
        if circuit_type == 'luz':
            dimerizavel = circuito_data.get('dimerizavel', False)
            power = circuito_data.get('potencia', 0.0)
            
            if dimerizavel:
                load_type = 2
                profile_guid = "10000000-0000-0000-0000-000000000002"
                description = "Dimmer"
            else:
                load_type = 0
                profile_guid = "10000000-0000-0000-0000-000000000001"
                description = "ON/OFF"
                
            new_circuit = {
                "$type": "Circuit",
                "LoadType": load_type,
                "IconPath": 0,
                "Power": power,
                "ProfileGuid": profile_guid,
                "Unit": self._create_unit(),
                "Name": circuit_name,
                "Guid": circuit_guid,
                "Description": description
            }
            
        elif circuit_type == 'persiana':
            new_circuit = {
                "$type": "Shade",
                "ShadeType": 0,
                "ShadeIcon": 0,
                "ProfileGuid": "20000000-0000-0000-0000-000000000001",
                "UnitMovement": self._create_unit(),
                "UnitOpenedPercentage": self._create_unit(),
                "UnitCurrentPosition": self._create_unit(),
                "Name": circuit_name,
                "Guid": circuit_guid,
                "Description": "Persiana"
            }
            
        elif circuit_type == 'hvac':
            new_circuit = {
                "$type": "HVAC",
                "ProfileGuid": "14000000-0000-0000-0000-000000000001",
                "ControlModelGuid": "17000000-0000-0000-0000-000000000001",
                "Unit": self._create_unit(),
                "Name": circuit_name,
                "Guid": circuit_guid,
                "Description": "HVAC"
            }
        
        else:
            print(f"⚠️ Tipo de circuito não suportado: {circuit_type}")
            return None
        
        room_json.setdefault("LoadOutputs", []).append(new_circuit)
        self.circuit_guid_map[circuito_data.get('id')] = circuit_guid
        return circuit_guid

    def _link_circuit_to_module(self, circuito_data):
        """Vincula um circuito a um módulo"""
        vinculacao = circuito_data.get('vinculacao')
        if not vinculacao:
            return
            
        module_data = vinculacao.get('modulo')
        if not module_data:
            return
            
        module_id = module_data.get('id')
        canal = vinculacao.get('canal', 1)
        circuit_guid = self.circuit_guid_map.get(circuito_data.get('id'))
        module_guid = self.module_guid_map.get(module_id)
        
        if not circuit_guid or not module_guid:
            return
            
        # Encontrar o módulo e fazer a vinculação
        module_json = self._find_module_by_guid(module_guid)
        if not module_json:
            return
            
        circuit_type = circuito_data.get('tipo')
        slot_name = self._get_slot_name_for_circuit_type(circuit_type)
        
        # Encontrar o slot correto e fazer a vinculação
        for slot in module_json.get('Slots', []):
            if slot.get('Name') == slot_name:
                if canal <= len(slot['SubItemsGuid']):
                    slot['SubItemsGuid'][canal-1] = circuit_guid
                    print(f"✅ Circuito {circuito_data.get('identificador')} vinculado ao módulo {module_data.get('nome')}, canal {canal}")
                break

    def _process_keypads(self, areas_data):
        """Processa keypads e seus botões"""
        for area_data in areas_data:
            for ambiente_data in area_data.get('ambientes', []):
                for keypad_data in ambiente_data.get('keypads', []):
                    self._create_keypad(area_data, ambiente_data, keypad_data)

    def _create_keypad(self, area_data, ambiente_data, keypad_data):
        """Cria um keypad no projeto RWP"""
        area_name = area_data.get('nome')
        room_name = ambiente_data.get('nome')
        
        area_json = next((a for a in self.project_data["Areas"] if a["Name"] == area_name), None)
        if not area_json:
            return
            
        room_json = next((r for r in area_json["SubItems"] if r["Name"] == room_name), None)
        if not room_json:
            return
        
        keypad_guid = str(uuid.uuid4())
        button_count = keypad_data.get('button_count', 4)
        
        keypad_payload = {
            "$type": "Keypad",
            "DriverGuid": self.keypad_driver_guid,
            "ModuleInterface": False,
            "Keypad4x4": False,
            "HsnetAddress": keypad_data.get('hsnet', self._find_next_hsnet()),
            "TipoEntrada1ChaveLD": 0,
            "TipoEntrada2ChaveLD": 0,
            "UnitEntradaDigital1": self._create_unit_composer("UnitEntradaDigital1", 1, 0, 0, 0),
            "UnitEntradaDigital2": self._create_unit_composer("UnitEntradaDigital2", 2, 0, 0, 0),
            "UnitAnyKey": self._create_unit_composer("UnitAnyKey", 3, 0, 0, 0),
            "BrightUnit": 0,
            "UnitBrightnessColor1": self._create_unit_composer("UnitBrightnessColor1", 1, 600, 1, 1),
            "UnitBrightnessColor2": self._create_unit_composer("UnitBrightnessColor2", 2, 600, 1, 1),
            "UnitBeepProfile": self._create_unit_composer("UnitBeepProfile", 3, 600, 1, 1),
            "UnitVolumeProfile": self._create_unit_composer("UnitVolumeProfile", 4, 600, 1, 1),
            "UnitVolumeKey": self._create_unit_composer("UnitVolumeKey", 5, 0, 0, 0),
            "UnitBlockedKeypad": self._create_unit_composer("UnitBlockedKeypad", 1, 100, 0, 1),
            "UnitPIN32": self._create_unit_composer("UnitPIN32", 1, 1100, 1, 0),
            "NightModeGroup": 0,
            "LightSensorMode": 0,
            "LightSensorMasterID": 0,
            "DevID": keypad_data.get('dev_id', keypad_data.get('hsnet', self._find_next_dev_id())),
            "ListKeypadButtons": [],
            "ListKeypadButtonsLayout2": [],
            "ProfileGuid": self.keypad_profile_guid,
            "ButtonCountLayout2": 0,
            "ButtonLayout2": 0,
            "Slots": [],
            "hold": 0,
            "ButtonLayout1": 7,  # Layout para 4 botões
            "ModelName": keypad_data.get('modelo', 'RQR-K'),
            "Color": keypad_data.get('color', 'WHITE'),
            "ButtonColor": keypad_data.get('button_color', 'WHITE'),
            "Name": keypad_data.get('nome', 'Keypad'),
            "Notes": keypad_data.get('notes'),
            "Guid": keypad_guid,
            "ButtonCount": button_count,
        }
        
        # Processar botões
        for button_data in keypad_data.get('buttons', []):
            button_payload = self._create_keypad_button(button_data, button_data.get('ordem', 1))
            keypad_payload["ListKeypadButtons"].append(button_payload)
        
        room_json.setdefault("UserInterfaces", []).append(keypad_payload)

    def _create_keypad_button(self, button_data, ordem):
        """Cria um botão de keypad"""
        # Determinar target_guid
        target_guid = self.zero_guid
        if button_data.get('cena'):
            target_guid = button_data['cena'].get('guid', self.zero_guid)
        elif button_data.get('circuito'):
            circuit_id = button_data['circuito'].get('id')
            target_guid = self.circuit_guid_map.get(circuit_id, self.zero_guid)
        
        # Configurar estilo do botão
        button_style_guid = self.zero_guid
        style_properties = None
        
        if button_data.get('is_rocker') and button_data.get('icon'):
            button_style_guid = "13000000-0000-0000-0000-000000000003"
            style_properties = {
                "$type": "Dictionary`2",
                "STYLE_PROP_ICON": self.icon_guids.get(button_data['icon'], self.zero_guid),
            }
        elif button_data.get('icon'):
            button_style_guid = "13000000-0000-0000-0000-000000000002"
            style_properties = {
                "$type": "Dictionary`2",
                "STYLE_PROP_ICON": self.icon_guids.get(button_data['icon'], self.zero_guid),
            }
        
        button_payload = {
            "$type": "RockerKeypadButton",
            "StylePropertiesSerializable": style_properties,
            "DoublePressDelay": False,
            "TargetDoubleObjectGuid": self.zero_guid,
            "ModoDoublePress": button_data.get('modo_double_press', 0),
            "TargetObjectGuid": target_guid,
            "ModoPress": button_data.get('modo_press', 0),
            "TargetLongObjectGuid": self.zero_guid,
            "ModoLongPress": button_data.get('modo_long_press', 0),
            "TargetReleaseObjectGuid": self.zero_guid,
            "ModoRelease": button_data.get('modo_release', 0),
            "TargetDoubleReleaseObjectGuid": self.zero_guid,
            "ModoDoubleRelease": button_data.get('modo_double_release', 0),
            "TargetLongReleaseObjectGuid": self.zero_guid,
            "ModoLongRelease": button_data.get('modo_long_release', 0),
            "Name": button_data.get('nome', f'Botão {ordem}'),
            "Guid": str(uuid.uuid4()),
            "StyleGuid": button_style_guid,
            "Order": ordem,
        }
        
        return button_payload

    def _setup_main_controller(self, modules_data):
        """Configura o controlador principal"""
        main_controller = next((m for m in modules_data if m.get('is_logic_server')), None)
        if not main_controller:
            return
            
        # Configurar o controlador como Logic Server
        controller_guid = self.module_guid_map.get(main_controller.get('id'))
        if not controller_guid:
            return
            
        controller_json = self._find_module_by_guid(controller_guid)
        if controller_json:
            controller_json["Logicserver"] = True

    # Métodos auxiliares
    def _get_default_special_actions(self):
        return [
            {"$type": "SpecialAction", "Name": "All HVAC",  "Guid": str(uuid.uuid4()), "Type": 4},
            {"$type": "SpecialAction", "Name": "All Lights","Guid": str(uuid.uuid4()), "Type": 2},
            {"$type": "SpecialAction", "Name": "All Shades","Guid": str(uuid.uuid4()), "Type": 3},
            {"$type": "SpecialAction", "Name": "OFF",       "Guid": str(uuid.uuid4()), "Type": 0},
            {"$type": "SpecialAction", "Name": "Volume",    "Guid": str(uuid.uuid4()), "Type": 1},
        ]

    def _create_unit(self):
        return {
            "$type": "Unit",
            "UnitGuid": self.zero_guid,
            "UnitType": 0,
            "UnitNumber": 0,
            "UnitPort": 0,
            "UnitIO": 0,
            "UnitSlot": 0,
            "UnitModuleGuid": self.zero_guid,
            "UnitModuleName": None,
            "UnitModuleType": 0,
        }

    def _create_unit_composer(self, name, unit_number, unit_type, unit_port, unit_io):
        return {
            "$type": "UnitComposer",
            "Name": name,
            "UnitGuid": self.zero_guid,
            "UnitType": unit_type,
            "UnitNumber": unit_number,
            "UnitPort": unit_port,
            "UnitIO": unit_io,
            "UnitSlot": 0,
            "UnitModuleGuid": self.zero_guid,
            "UnitModuleName": None,
            "UnitModuleType": 0,
        }

    def _create_controller_unit_composers(self):
        return [
            self._create_unit_composer("UnitLogicServer", 1, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer2", 2, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer3", 3, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer4", 4, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer5", 5, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer6", 6, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer7", 7, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer8", 8, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer9", 9, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer10", 10, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer11", 11, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer12", 12, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer13", 13, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer14", 14, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer15", 15, 0, 0, 0),
            self._create_unit_composer("UnitLogicServer16", 16, 0, 0, 0),
        ]

    def _get_slot_type(self, slot_name):
        slot_types = {
            'Load ON/OFF': 0,
            'Load Dim': 1,
            'Shade': 2,
            'IR': 3,
            'ACNET/RNET': 4,
            'Scene': 8
        }
        return slot_types.get(slot_name, 0)

    def _get_slot_name_for_circuit_type(self, circuit_type):
        slot_mapping = {
            'luz': 'Load ON/OFF',
            'dimmer': 'Load Dim',
            'persiana': 'Shade',
            'hvac': 'ACNET/RNET'
        }
        return slot_mapping.get(circuit_type, 'Load ON/OFF')

    def _find_board_by_guid(self, board_guid):
        for area in self.project_data["Areas"]:
            for room in area.get("SubItems", []):
                for board in room.get("AutomationBoards", []):
                    if board["Guid"] == board_guid:
                        return board
        return None

    def _find_module_by_guid(self, module_guid):
        for area in self.project_data["Areas"]:
            for room in area.get("SubItems", []):
                for board in room.get("AutomationBoards", []):
                    for module in board.get("ModulesList", []):
                        if module["Guid"] == module_guid:
                            return module
        return None

    def _find_next_hsnet(self):
        used_hsnets = set()
        for area in self.project_data["Areas"]:
            for room in area.get("SubItems", []):
                for board in room.get("AutomationBoards", []):
                    for module in board.get("ModulesList", []):
                        used_hsnets.add(module.get("HsnetAddress", 0))
                for ui in room.get("UserInterfaces", []):
                    used_hsnets.add(ui.get("HsnetAddress", 0))
        
        next_hsnet = 1
        while next_hsnet in used_hsnets:
            next_hsnet += 1
        return next_hsnet

    def _find_next_dev_id(self):
        used_dev_ids = set()
        for area in self.project_data["Areas"]:
            for room in area.get("SubItems", []):
                for board in room.get("AutomationBoards", []):
                    for module in board.get("ModulesList", []):
                        used_dev_ids.add(module.get("DevID", 0))
                for ui in room.get("UserInterfaces", []):
                    used_dev_ids.add(ui.get("DevID", 0))
        
        next_dev_id = 1
        while next_dev_id in used_dev_ids:
            next_dev_id += 1
        return next_dev_id

    def save_rwp_file(self, filename):
        """Salva o projeto como arquivo RWP"""
        if not self.project_data:
            print("❌ Nenhum projeto para salvar")
            return False
            
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(self.project_data, f, indent=2, ensure_ascii=False)
            print(f"✅ Arquivo RWP salvo como: {filename}")
            return True
        except Exception as e:
            print(f"❌ Erro ao salvar arquivo RWP: {e}")
            return False

def main():
    """Função principal para uso standalone"""
    import sys
    import os
    
    if len(sys.argv) != 2:
        print("Uso: python roehn_converter_standalone.py <arquivo_json>")
        sys.exit(1)
    
    json_file = sys.argv[1]
    
    if not os.path.exists(json_file):
        print(f"❌ Arquivo não encontrado: {json_file}")
        sys.exit(1)
    
    try:
        # Carregar JSON
        with open(json_file, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        # Converter
        converter = RoehnStandaloneConverter()
        project_data = converter.process_json_project(json_data)
        
        if project_data:
            # Gerar nome do arquivo de saída
            base_name = os.path.splitext(json_file)[0]
            output_file = f"{base_name}.rwp"
            
            # Salvar arquivo RWP
            converter.save_rwp_file(output_file)
        else:
            print("❌ Falha na conversão do projeto")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Erro: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()