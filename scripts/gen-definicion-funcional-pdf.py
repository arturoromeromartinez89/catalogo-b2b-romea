# -*- coding: utf-8 -*-
"""Genera la definicion funcional y el modelo de datos de NEXOR IA en PDF.

El contenido esta tomado del esquema real aplicado en Supabase staging
(vafqcvpzksjlrborxoos) y de las decisiones de producto ya cerradas.
No describe intenciones: describe lo que existe y lo que falta.

Uso:  python scripts/gen-definicion-funcional-pdf.py
Sale: docs/NEXOR-IA-DEFINICION-FUNCIONAL-Y-DATOS.pdf
"""

import os
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, PageBreak,
                                PageTemplate, Paragraph, Spacer, Table, TableStyle)

INK = colors.HexColor("#0b1330")
INK_SOFT = colors.HexColor("#5c698d")
CYAN = colors.HexColor("#087e74")
LINK = colors.HexColor("#2c4a9e")
LINE = colors.HexColor("#d7dded")
PAPER = colors.HexColor("#f5f7fc")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "docs", "NEXOR-IA-DEFINICION-FUNCIONAL-Y-DATOS.pdf")

styles = getSampleStyleSheet()


def style(name, size, leading, color=INK, bold=False, space_before=0, space_after=0,
          tracking=0, upper=False):
    return ParagraphStyle(
        name, parent=styles["Normal"], fontName="Helvetica-Bold" if bold else "Helvetica",
        fontSize=size, leading=leading, textColor=color, alignment=TA_LEFT,
        spaceBefore=space_before, spaceAfter=space_after, wordWrap="CJK" if upper else None,
    )


S = {
    "title": style("t", 30, 32, INK, True, 0, 6),
    "subtitle": style("st", 12, 17, INK_SOFT, False, 0, 4),
    "eyebrow": style("ey", 8.5, 12, CYAN, True, 0, 5),
    "h1": style("h1", 17, 21, INK, True, 16, 7),
    "h2": style("h2", 12, 16, INK, True, 12, 5),
    "body": style("b", 9.5, 14, INK, False, 0, 5),
    "small": style("sm", 8, 11, INK_SOFT, False, 0, 3),
    "cell": style("c", 7.6, 10, INK),
    "cellb": style("cb", 7.6, 10, INK, True),
    "cellm": style("cm", 7.2, 9.5, INK_SOFT),
    "code": ParagraphStyle("code", parent=styles["Normal"], fontName="Courier",
                           fontSize=7.6, leading=10, textColor=INK),
}


def p(text, kind="body"):
    return Paragraph(text, S[kind])


def bullets(items, kind="body"):
    return [Paragraph("&bull;&nbsp;&nbsp;" + t, S[kind]) for t in items]


def table(rows, widths, header=True, zebra=True):
    data = []
    for i, row in enumerate(rows):
        kind = "cellb" if (header and i == 0) else "cell"
        data.append([c if hasattr(c, "wrap") else Paragraph(str(c), S[kind]) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        cmds += [("BACKGROUND", (0, 0), (-1, 0), PAPER),
                 ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK_SOFT)]
    if zebra:
        for r in range(1 if header else 0, len(data)):
            if r % 2 == 0:
                cmds.append(("BACKGROUND", (0, r), (-1, r), colors.HexColor("#fafbfe")))
    t.setStyle(TableStyle(cmds))
    return t


def field_table(rows):
    head = ["Campo", "Tipo", "Reglas", "Para que sirve"]
    return table([head] + rows, [34 * mm, 24 * mm, 42 * mm, 68 * mm])


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, 272 * mm, 196 * mm, 272 * mm)
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.setFillColor(CYAN)
    canvas.drawString(20 * mm, 275 * mm, "NEXOR IA")
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(INK_SOFT)
    canvas.drawRightString(196 * mm, 275 * mm, "Definicion funcional y modelo de datos")
    canvas.line(20 * mm, 16 * mm, 196 * mm, 16 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(20 * mm, 11 * mm, "Documento interno - version 1.0 - 17 de agosto de 2026")
    canvas.drawRightString(196 * mm, 11 * mm, "Pagina %d" % doc.page)
    canvas.restoreState()


def hierarchy_diagram():
    """Cadena operativa dibujada como tabla de cajas: se lee sin herramientas."""
    niveles = [
        ("Cliente", "tenants", "La empresa contratante"),
        ("Proyecto", "projects", "El compromiso completo"),
        ("Solucion", "project_solutions", "Una parte del sistema que entrega valor"),
        ("Tarea", "project_tasks (parent_task_id nulo)", "Un bloque de trabajo"),
        ("Actividad", "project_tasks (parent_task_id lleno)", "El trabajo que se ejecuta y se marca"),
    ]
    rows = []
    for i, (nivel, tabla, desc) in enumerate(niveles):
        flecha = "" if i == 0 else "&#8595;"
        rows.append([
            Paragraph(flecha, S["cellm"]),
            Paragraph("<b>%s</b>" % nivel, S["cell"]),
            Paragraph("<font face='Courier'>%s</font>" % tabla, S["cellm"]),
            Paragraph(desc, S["cellm"]),
        ])
    t = Table(rows, colWidths=[8 * mm, 26 * mm, 62 * mm, 72 * mm], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (1, 0), (-1, -1), 0.5, LINE),
        ("INNERGRID", (1, 0), (-1, -1), 0.4, LINE),
        ("BACKGROUND", (1, 0), (1, -1), PAPER),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def section(num, title):
    """El numero y su titulo nunca se separan al saltar de pagina."""
    return KeepTogether([p(num, "eyebrow"), p(title, "h1")])


def build():
    doc = BaseDocTemplate(OUT, pagesize=letter, leftMargin=20 * mm, rightMargin=19 * mm,
                          topMargin=24 * mm, bottomMargin=20 * mm,
                          title="NEXOR IA - Definicion funcional y modelo de datos",
                          author="NEXOR IA")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=header_footer)])

    f = []

    # ---------- Portada ----------
    f.append(Spacer(1, 34 * mm))
    f.append(p("SISTEMA DE GESTION DE PROYECTOS", "eyebrow"))
    f.append(p("NEXOR IA", "title"))
    f.append(p("Definicion funcional y modelo de datos", "subtitle"))
    f.append(Spacer(1, 8 * mm))
    f.append(p(
        "Este documento responde, en orden: para que es el programa, que hace, que funciones "
        "tiene, que datos maneja cada modulo y como se relacionan las tablas. El modelo de datos "
        "no es una propuesta: es el esquema que ya esta aplicado en el ambiente de pruebas.", "body"))
    f.append(Spacer(1, 6 * mm))
    f.append(table([
        ["Version", "1.0 - 17 de agosto de 2026"],
        ["Estado", "Fase 1 terminada y desplegada. Fase 2 en curso."],
        ["Base de datos", "PostgreSQL sobre Supabase"],
        ["Interfaz", "React 18 + Vite 6, desplegada en Vercel"],
        ["Ambiente de pruebas", "vafqcvpzksjlrborxoos (unico ambiente autorizado hoy)"],
        ["Idioma del sistema", "Espanol"],
    ], [34 * mm, 134 * mm], header=False))
    f.append(PageBreak())

    # ---------- 1. Para que es ----------
    f.append(section("1", "Para que es el programa"))
    f.append(p(
        "NEXOR IA vende proyectos de software a la medida. Hoy el seguimiento de esos proyectos "
        "vive en conversaciones, hojas sueltas y correos: nadie puede decir con evidencia cuanto "
        "esta realmente terminado, y el cliente solo se entera de su avance cuando pregunta.", "body"))
    f.append(p(
        "El programa es el sistema operativo de proyectos de NEXOR IA. Tiene dos caras que "
        "comparten la misma base de datos:", "body"))
    f.extend(bullets([
        "<b>NEXOR Studio (interno).</b> Donde el equipo estructura clientes, proyectos, soluciones, "
        "tareas y actividades, asigna responsables, registra evidencia y decide que se publica.",
        "<b>Portal del cliente (externo).</b> Donde el cliente entiende su avance, revisa lo entregado "
        "y aprueba o pide cambios, sin aprender gestion de proyectos ni lenguaje tecnico.",
    ]))
    f.append(Spacer(1, 3 * mm))
    f.append(p("Regla que gobierna todas las decisiones", "h2"))
    f.append(p(
        "<b>Maximo rigor interno. Minimo esfuerzo visible.</b> Debajo puede haber versiones, "
        "permisos, auditoria y validaciones; arriba la operacion debe ser hipersimple.", "body"))
    f.append(Spacer(1, 3 * mm))
    f.append(p("Dos reglas que condicionan el diseno tecnico", "h2"))
    f.extend(bullets([
        "<b>Ningun porcentaje puede ser arbitrario.</b> Todo avance se calcula desde registros; "
        "no existe un campo donde alguien escriba 60%.",
        "<b>Un cliente jamas puede ver datos de otro.</b> El aislamiento se aplica en la base de "
        "datos con Row Level Security, no en la interfaz.",
    ]))

    # ---------- 2. Que hace ----------
    f.append(section("2", "Que hace el programa"))
    f.append(p("La cadena operativa completa, de arriba hacia abajo:", "body"))
    f.append(Spacer(1, 2 * mm))
    f.append(hierarchy_diagram())
    f.append(Spacer(1, 4 * mm))
    f.append(p(
        "<b>El avance viaja al reves: de abajo hacia arriba.</b> Se marcan actividades; de ahi sale "
        "el avance de la tarea, de ahi el de la solucion y de ahi el del proyecto.", "body"))
    f.append(Spacer(1, 3 * mm))
    f.append(p("Decision de modelado que conviene entender antes de leer el codigo", "h2"))
    f.append(p(
        "Tarea y Actividad <b>no son dos tablas</b>. Son la misma tabla <font face='Courier'>"
        "project_tasks</font> con una autoreferencia: si <font face='Courier'>parent_task_id</font> "
        "es nulo el registro es una Tarea; si apunta a otra fila, es una Actividad de esa Tarea. "
        "Se hizo asi para heredar sin duplicar los comentarios, los adjuntos, las politicas de "
        "seguridad y la auditoria que ya existian y ya estaban probados. Un disparador impide "
        "un tercer nivel y obliga a que la actividad viva en el mismo proyecto y solucion que su tarea.", "body"))
    f.append(PageBreak())

    # ---------- 3. Roles ----------
    f.append(section("3", "Quien usa el sistema"))
    f.append(p(
        "Los roles ya existen en la tabla <font face='Courier'>profiles</font> y son los mismos "
        "que usa el resto de la plataforma. No se creo un segundo sistema de usuarios.", "body"))
    f.append(Spacer(1, 2 * mm))
    f.append(table([
        ["Rol", "Quien es", "Que puede hacer"],
        ["superadmin", "Equipo NEXOR IA", "Todo: crear clientes, proyectos, soluciones, tareas, "
         "actividades, asignar, publicar y ver la auditoria."],
        ["tenant_admin", "Contacto del cliente", "Ver solo su empresa y solo proyectos publicados. "
         "Aprobar o pedir cambios, comentar, adjuntar."],
        ["admin", "Operador de catalogo", "Rol heredado del catalogo B2B. No participa en proyectos hoy."],
        ["client", "Cliente de catalogo", "Rol heredado del catalogo B2B. Sin acceso a proyectos."],
    ], [24 * mm, 34 * mm, 110 * mm]))
    f.append(Spacer(1, 3 * mm))
    f.append(p(
        "<b>Pendiente de decision:</b> si el segundo integrante de NEXOR entra como "
        "<font face='Courier'>superadmin</font> (acceso a toda la plataforma, incluida la parte "
        "comercial y financiera) o si se crea un rol acotado a proyectos. Lo segundo implica "
        "escribir politicas nuevas en todas las tablas del modulo.", "small"))

    # ---------- 4. Modulos ----------
    f.append(section("4", "Modulos y funciones"))
    f.append(table([
        ["Modulo", "Funciones", "Estado"],
        ["Clientes", "Ver, crear, editar, pausar y reactivar sin borrar informacion. Abrir sus proyectos.",
         "Funcionando"],
        ["Proyectos", "Crear ligado a un cliente. Editar nombre, objetivo, meta, alcance incluido, "
         "exclusiones, fechas, etapa, estado y salud. Publicar o mantener en borrador.", "Funcionando"],
        ["Equipo", "Asignar personas al proyecto con papel: responsable, colaborador o revisor.", "Funcionando"],
        ["Soluciones", "Crear y editar soluciones dentro del proyecto, con alcance y fechas.",
         "Modelo listo; alta hipersimple pendiente"],
        ["Tareas y actividades", "Crear y editar, asignar responsable, fechas, prioridad y estado.",
         "Modelo listo; interfaz pendiente"],
        ["Tarjeta de actividad", "Detalle con estado, responsable, fechas, comentarios, archivos e "
         "historial de cambios.", "Comentarios, archivos y auditoria ya existen; falta la tarjeta unificada"],
        ["Avance", "Calculo automatico Actividad, Tarea, Solucion, Proyecto.",
         "Regla definida y centralizada; falta conectar el nivel Actividad"],
        ["Entregables y decisiones", "Compromisos verificables, criterios de aceptacion y aprobacion "
         "o solicitud de cambios del cliente.", "Funcionando"],
        ["Evidencia", "Horas dedicadas, actividad de desarrollo, comentarios y archivos.", "Funcionando"],
        ["Auditoria", "Registro inmutable de cada alta, cambio y baja, con autor y fecha.", "Funcionando"],
        ["Portal del cliente", "Inicio, Soluciones, Entregables, Documentos y Decisiones.",
         "Inicio terminado; el resto por completar"],
    ], [30 * mm, 96 * mm, 42 * mm]))
    f.append(PageBreak())

    # ---------- 5. Reglas ----------
    f.append(section("5", "Reglas de negocio que el codigo debe respetar"))
    f.append(p("Calculo del avance", "h2"))
    f.append(table([
        ["Nivel", "Como se calcula"],
        ["Actividad", "Terminada = 100%. Cualquier otro estado activo = 0%. Cancelada se muestra y se excluye."],
        ["Tarea", "Actividades terminadas entre actividades activas, ponderado por peso. Sin actividades, "
         "vale por su propio estado."],
        ["Solucion", "Promedio ponderado de sus tareas activas."],
        ["Proyecto", "Promedio ponderado de sus soluciones activas."],
    ], [26 * mm, 142 * mm]))
    f.append(Spacer(1, 3 * mm))
    f.extend(bullets([
        "El peso por omision es <b>1</b> y la interfaz no obliga a nadie a entender ponderaciones.",
        "Si no hay actividades, el porcentaje es <b>0%</b>, nunca un numero inventado.",
        "Lo cancelado se muestra en negro y queda fuera de todo calculo.",
        "Existe una segunda medida distinta, el <b>avance confirmado</b>, que sale de entregables "
        "aceptados por el cliente. No debe confundirse con el avance operativo.",
        "La regla vive en un solo archivo (<font face='Courier'>src/utils/projectHubModel.js</font>) "
        "y la consumen tanto el portal como el panel interno, para que no existan dos verdades.",
    ]))
    f.append(Spacer(1, 3 * mm))
    f.append(p("Estados globales", "h2"))
    f.append(p("Aplican igual a proyectos, soluciones, tareas, actividades y decisiones. "
               "El color nunca va solo: siempre lo acompana la palabra.", "body"))
    f.append(table([
        ["Significado", "Color", "Estados internos equivalentes"],
        ["Terminado", "Azul", "done, completed, delivered, approved, accepted"],
        ["En proceso", "Verde", "in_progress, active, review"],
        ["En espera", "Naranja", "pending, blocked, waiting, on_hold, needs_changes, rejected"],
        ["Atrasado", "Rojo", "fecha vencida sin cierre, at_risk"],
        ["Cancelado", "Negro", "cancelled"],
        ["No iniciado", "Gris", "draft, planned, backlog, todo"],
    ], [30 * mm, 20 * mm, 118 * mm]))
    f.append(Spacer(1, 3 * mm))
    f.append(p("Publicacion", "h2"))
    f.append(p(
        "Un proyecto tiene <font face='Courier'>published</font> y casi todos los registros hijos "
        "tienen <font face='Courier'>visible_to_client</font>. El cliente solo ve lo que cumple "
        "ambas condiciones. Esto permite preparar un proyecto completo en borrador antes de "
        "ensenarselo a nadie.", "body"))
    f.append(PageBreak())

    # ---------- 6. Modelo de datos ----------
    f.append(section("6", "Modelo de datos por modulo"))
    f.append(p(
        "Todas las tablas viven en el esquema <font face='Courier'>public</font>. Todas las del "
        "modulo de proyectos llevan <font face='Courier'>tenant_id</font> y "
        "<font face='Courier'>project_id</font>, y un disparador verifica que ambos pertenezcan "
        "a la misma empresa. Se omiten por brevedad las columnas "
        "<font face='Courier'>created_at</font> y <font face='Courier'>updated_at</font>, que "
        "existen en casi todas.", "body"))

    f.append(p("6.1  Clientes", "h2"))
    f.append(p("Tabla <font face='Courier'>tenants</font>. Es la entidad que ya existia para el "
               "catalogo B2B; se reutiliza como cliente. No se creo una tabla nueva.", "small"))
    f.append(field_table([
        ["id", "uuid", "PK", "Identificador"],
        ["name", "text", "obligatorio", "Nombre comercial del cliente"],
        ["slug", "text", "unico", "Identificador de direccion. No cambia despues de crearse"],
        ["status", "text", "active | paused", "Pausar conserva toda la informacion"],
    ]))

    f.append(p("6.2  Usuarios", "h2"))
    f.append(p("Tabla <font face='Courier'>profiles</font>, ligada uno a uno con "
               "<font face='Courier'>auth.users</font> de Supabase.", "small"))
    f.append(field_table([
        ["id", "uuid", "PK, FK a auth.users", "Identificador de la cuenta"],
        ["email", "text", "unico", "Correo de acceso"],
        ["role", "text", "superadmin | tenant_admin | admin | client", "Determina todo el acceso"],
        ["tenant_id", "uuid", "FK a tenants", "Empresa a la que pertenece. Nulo en NEXOR"],
        ["active", "boolean", "por omision true", "Una cuenta inactiva no pasa los controles"],
    ]))

    f.append(p("6.3  Proyecto", "h2"))
    f.append(p("Tabla <font face='Courier'>projects</font>.", "small"))
    f.append(field_table([
        ["id", "uuid", "PK", "Identificador"],
        ["tenant_id", "uuid", "FK a tenants", "Cliente dueno del proyecto"],
        ["name", "text", "1-160, unico por cliente", "Nombre del proyecto"],
        ["description", "text", "", "Descripcion en lenguaje de cliente"],
        ["objective", "text", "", "Que problema resuelve"],
        ["goal", "text", "", "Meta medible"],
        ["included_scope", "text[]", "", "Alcance incluido, un compromiso por entrada"],
        ["excluded_scope", "text[]", "", "Exclusiones explicitas"],
        ["status", "text", "draft | active | on_hold | completed | cancelled", "Estado del proyecto"],
        ["health", "text", "green | yellow | red", "Semaforo de salud"],
        ["current_phase_name", "text", "", "Etapa actual visible"],
        ["start_date", "date", "", "Inicio"],
        ["estimated_end_date", "date", "&gt;= start_date", "Fecha objetivo"],
        ["actual_end_date", "date", "", "Cierre real"],
        ["internal_owner_name", "text", "", "Responsable interno"],
        ["published", "boolean", "por omision false", "Si es false, el cliente no lo ve"],
        ["progress_percentage", "integer", "heredado", "Se conserva por compatibilidad. Ya no se captura"],
    ]))
    f.append(PageBreak())

    f.append(p("6.4  Equipo del proyecto", "h2"))
    f.append(p("Tabla <font face='Courier'>project_members</font>. Apunta a "
               "<font face='Courier'>profiles</font>: no duplica usuarios.", "small"))
    f.append(field_table([
        ["id", "uuid", "PK", "Identificador"],
        ["tenant_id", "uuid", "FK a tenants", "Empresa"],
        ["project_id", "uuid", "FK a projects", "Proyecto"],
        ["profile_id", "uuid", "FK a profiles", "Persona asignada"],
        ["project_role", "text", "responsable | colaborador | revisor", "Papel dentro del proyecto"],
        ["active", "boolean", "por omision true", "Permite retirar sin perder historia"],
        ["", "", "unico (project_id, profile_id)", "Una persona no se repite en el mismo proyecto"],
    ]))

    f.append(p("6.5  Solucion", "h2"))
    f.append(p("Tabla <font face='Courier'>project_solutions</font>.", "small"))
    f.append(field_table([
        ["id", "uuid", "PK", "Identificador"],
        ["project_id", "uuid", "FK a projects", "Proyecto al que pertenece"],
        ["phase_id", "uuid", "FK a project_phases", "Etapa opcional"],
        ["name", "text", "1-180, unico por proyecto", "Nombre de la solucion"],
        ["description", "text", "", "Que resuelve"],
        ["status", "text", "draft | planned | in_progress | waiting | needs_changes | completed | cancelled",
         "Estado"],
        ["stage_name", "text", "", "Bloque visible para el cliente"],
        ["next_milestone", "text", "", "Siguiente hito"],
        ["scope_items", "text[]", "", "Que incluye"],
        ["start_date / estimated_end_date", "date", "fin &gt;= inicio", "Ventana de trabajo"],
        ["completed_at", "timestamptz", "", "Cierre real"],
        ["weight", "numeric", "&gt; 0, por omision 1", "Peso dentro del proyecto"],
        ["sort_order", "integer", "", "Orden de lectura"],
        ["visible_to_client", "boolean", "por omision true", "Publicacion"],
    ]))

    f.append(p("6.6  Tarea y Actividad", "h2"))
    f.append(p("Tabla <font face='Courier'>project_tasks</font>. Una sola tabla para los dos niveles.", "small"))
    f.append(field_table([
        ["id", "uuid", "PK", "Identificador"],
        ["parent_task_id", "uuid", "FK a project_tasks", "<b>Nulo = Tarea. Con valor = Actividad</b>"],
        ["project_id", "uuid", "FK a projects", "Proyecto"],
        ["solution_id", "uuid", "FK a project_solutions", "Solucion. La actividad la hereda de su tarea"],
        ["deliverable_id", "uuid", "FK a project_deliverables", "Entregable al que contribuye"],
        ["objective_id / phase_id", "uuid", "FK", "Periodo y etapa, opcionales"],
        ["title", "text", "1-180", "Titulo"],
        ["description", "text", "", "Detalle"],
        ["status", "text", "backlog | todo | in_progress | review | done | blocked | cancelled", "Estado"],
        ["priority", "text", "low | medium | high | critical", "Prioridad"],
        ["start_date / due_date", "date", "fin &gt;= inicio", "Fechas"],
        ["assignee_profile_id", "uuid", "FK a profiles", "Responsable real"],
        ["assignee_name", "text", "heredado", "Responsable en texto libre. Queda por compatibilidad"],
        ["estimated_hours", "numeric", "&gt;= 0 o nulo", "Estimacion"],
        ["weight", "numeric", "&gt; 0, por omision 1", "Peso en el calculo"],
        ["completed_at", "timestamptz", "", "Cierre real"],
        ["sort_order", "numeric", "", "Orden"],
        ["visible_to_client", "boolean", "", "Publicacion"],
        ["client_can_move / comment / upload", "boolean", "", "Que puede hacer el cliente"],
    ]))
    f.append(PageBreak())

    f.append(p("6.7  Compromisos y decisiones", "h2"))
    f.append(table([
        ["Tabla", "Para que sirve", "Campos clave"],
        ["project_deliverables", "Compromisos verificables. De aqui sale el avance confirmado.",
         "name, status (pending | in_progress | delivered | approved), weight, solution_id, "
         "estimated_delivery_date, approved_at"],
        ["project_acceptance_criteria", "Condiciones que se deben cumplir para aceptar.",
         "description, status (pending | accepted | needs_changes | not_applicable), solution_id, "
         "deliverable_id, accepted_at"],
        ["project_approvals", "Decisiones del cliente: aprobar o pedir cambios.",
         "title, status (pending | approved | rejected | resolved), decision_type, due_date, "
         "client_comment, resolved_by, resolved_at"],
        ["project_solution_brief_versions", "Ficha de solucion versionada: problema, objetivo, proceso "
         "actual y propuesto, alcance, riesgos.",
         "version_number, status, problem, objective, included_scope, excluded_scope, "
         "users_and_permissions, impacts, assumptions_and_risks"],
        ["project_phases", "Etapas como bloques de tiempo. No aportan peso al avance.",
         "name, status, sort_order, estimated_end_date"],
        ["project_objectives", "Periodos de trabajo para agrupar tareas.",
         "title, period_start, period_end, status"],
    ], [42 * mm, 52 * mm, 74 * mm]))

    f.append(p("6.8  Evidencia y trazabilidad", "h2"))
    f.append(table([
        ["Tabla", "Para que sirve", "Campos clave"],
        ["project_task_comments", "Conversacion sobre una actividad.", "task_id, body, created_by, visible_to_client"],
        ["project_task_attachments", "Archivos adjuntos. El binario vive en Storage; aqui solo el registro.",
         "task_id, file_name, storage_path (unico), mime_type, file_size (max 25 MB)"],
        ["project_time_entries", "Horas dedicadas. Fuente de la metrica de horas.",
         "solution_id, task_id, work_date, minutes, contributor_name"],
        ["project_development_activity", "Actividad de desarrollo registrada. Es evidencia, no avance ni calidad.",
         "activity_date, repository_label, lines_added, lines_deleted, commits_count"],
        ["project_updates", "Feed curado de comunicacion al cliente.", "title, description, update_type"],
        ["project_documents", "Contratos, propuestas, alcance y manuales.",
         "document_type, name, external_url (obligatorio https)"],
        ["project_audit_events", "Bitacora tecnica inmutable. Alimenta el historial de cambios.",
         "entity_type, entity_id, action, event_data (jsonb con antes y despues), actor_id"],
    ], [42 * mm, 52 * mm, 74 * mm]))
    f.append(Spacer(1, 3 * mm))
    f.append(p(
        "La auditoria no se escribe desde la aplicacion: la graba un disparador de base de datos en "
        "cada alta, cambio y baja de soluciones, fichas, entregables, criterios, tareas, actividades, "
        "horas, desarrollo, decisiones y equipo. Por eso el historial de una actividad no requiere "
        "codigo nuevo, solo leerlo.", "small"))
    f.append(PageBreak())

    # ---------- 7. Seguridad ----------
    f.append(section("7", "Seguridad y aislamiento entre clientes"))
    f.append(p(
        "Todas las tablas tienen Row Level Security activo. El aislamiento no depende de la "
        "interfaz: aunque alguien llamara la API directamente, la base no devuelve filas ajenas.", "body"))
    f.append(table([
        ["Funcion", "Que resuelve"],
        ["is_superadmin()", "Verdadero si la cuenta es superadmin y esta activa."],
        ["is_tenant_admin()", "Verdadero si la cuenta administra su empresa."],
        ["current_tenant_id()", "Devuelve la empresa de la cuenta que consulta."],
    ], [40 * mm, 128 * mm]))
    f.append(Spacer(1, 3 * mm))
    f.append(p("Patron de politicas", "h2"))
    f.extend(bullets([
        "<b>Escritura:</b> solo <font face='Courier'>is_superadmin()</font>.",
        "<b>Lectura del cliente:</b> exige tres condiciones a la vez: que la fila sea de su empresa, "
        "que el proyecto este publicado y que el registro tenga <font face='Courier'>visible_to_client</font>.",
        "<b>Archivos:</b> bucket privado <font face='Courier'>project-hub-files</font>, ruta "
        "<font face='Courier'>empresa/proyecto/actividad/archivo</font>, limite de 25 MB y entrega "
        "por URL firmada de corta duracion. No hay archivos publicos.",
        "<b>Movimiento de tareas por el cliente:</b> se hace por una funcion controlada "
        "(<font face='Courier'>move_project_task</font>) que valida estado permitido y permisos, "
        "en vez de dar permiso de escritura directa.",
    ]))
    f.append(Spacer(1, 3 * mm))
    f.append(p("Ambientes", "h2"))
    f.append(table([
        ["Ambiente", "Identificador", "Regla"],
        ["Pruebas", "vafqcvpzksjlrborxoos", "Unico ambiente autorizado para desarrollo"],
        ["Produccion", "pyignizeoevafifzfnik", "No se toca sin autorizacion explicita y por separado"],
    ], [30 * mm, 60 * mm, 78 * mm]))
    f.append(Spacer(1, 2 * mm))
    f.append(p("El script de despliegue verifica el proyecto enlazado y aborta si detecta produccion. "
               "El compilador tambien falla si una compilacion de pruebas apunta a la base productiva.", "small"))

    # ---------- 8. Estado ----------
    f.append(section("8", "Estado real al 17 de agosto de 2026"))
    f.append(table([
        ["Terminado y desplegado", "En curso", "Pendiente"],
        ["Modelo de datos completo, con integridad, disparadores y auditoria.\n\n"
         "Portal del cliente: Inicio con avance, etapa, decisiones pendientes, horas, actividad de "
         "desarrollo y cronograma de tres meses.\n\n"
         "Alta de clientes y proyectos con objetivo, meta, alcance, exclusiones y equipo.\n\n"
         "Aislamiento por empresa y publicacion controlada.",
         "Panel interno con la identidad visual definitiva.\n\n"
         "Jerarquia operativa de cinco niveles ya soportada por la base.",
         "Alta hipersimple de soluciones, tareas y actividades.\n\n"
         "Tarjeta interactiva de actividad.\n\n"
         "Conexion del calculo automatico al nivel Actividad.\n\n"
         "Secciones Soluciones, Entregables, Documentos y Decisiones del portal."],
    ], [56 * mm, 46 * mm, 66 * mm]))

    f.append(section("9", "Decisiones abiertas"))
    f.append(table([
        ["Decision", "Por que importa"],
        ["Dominio propio por proyecto o por cliente",
         "Cambia si el dominio es una columna de projects o de tenants, y como se resuelve el "
         "enrutamiento cuando un cliente tenga dos proyectos."],
        ["Rol del segundo integrante de NEXOR",
         "superadmin es inmediato pero da acceso a toda la plataforma. Un rol acotado a proyectos "
         "obliga a escribir politicas nuevas en todas las tablas del modulo."],
        ["Que pasa con los modulos heredados del catalogo",
         "Empresas y Metricas vienen del catalogo B2B. Definir si siguen en el menu diario o se "
         "agrupan aparte."],
        ["Datos reales en el ambiente de pruebas",
         "Se acordo estructura real de proyectos, pero sin datos personales, financieros ni de "
         "contacto de clientes."],
    ], [50 * mm, 118 * mm]))

    doc.build(f)
    print("PDF generado en:", OUT)


if __name__ == "__main__":
    build()
