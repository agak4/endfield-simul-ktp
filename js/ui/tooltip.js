/**
 * ui/tooltip.js — 마우스오버 툴팁 시스템
 *
 * [역할]
 * - 애플리케이션 전반의 툴팁 로직을 중앙 집중화하여 관리합니다.
 * - 오퍼레이터, 무기, 장비, 스킬, 상태 이상 등에 대한 상세 정보를 HTML 툴팁으로 제공합니다.
 * - 모바일/태블릿(≤1024px)에서는 사용자 경험을 고려하여 툴팁 노출을 제한합니다.
 *
 * [주요 구성]
 * 1. 설정/상수 (HIGHLIGHTS, COLORS): 텍스트 색상화 및 속성별 테마 설정
 * 2. 내부 유틸리티 (colorizeText, position): 키워드 하이라이트 및 위치 계산
 * 3. 생명주기 제어 (init, show, hide): 이벤트 바인딩 및 표시 관리
 * 4. HTML 렌더러 (render*): 각 엔티티 타입별 툴팁 HTML 생성
 */

const AppTooltip = {
    el: null,

    // ==========================================
    // 1. 설정 및 상수
    // ==========================================

    /** 텍스트 내 키워드 하이라이트 매핑 (클래스명 또는 CSS 색상 코드) */
    HIGHLIGHTS: {
        '공격력': 'kw-special',
        '물리 피해': 'kw-phys', '아츠 피해': 'kw-arts', '열기 피해': 'kw-heat', '전기 피해': 'kw-elec', '냉기 피해': 'kw-cryo', '자연 피해': 'kw-nature',
        '받는 물리 피해': 'kw-phys', '받는 아츠 피해': 'kw-arts', '받는 열기 피해': 'kw-heat', '받는 전기 피해': 'kw-elec', '받는 냉기 피해': 'kw-cryo', '받는 자연 피해': 'kw-nature',
        '물리 취약': 'kw-special', '아츠 취약': 'kw-special', '열기 취약': 'kw-heat', '전기 취약': 'kw-elec', '냉기 취약': 'kw-cryo', '자연 취약': 'kw-nature',
        '열기 부착': 'kw-heat', '전기 부착': 'kw-elec', '냉기 부착': 'kw-cryo', '자연 부착': 'kw-nature',
        '연소': 'kw-heat', '감전': 'kw-elec', '동결': 'kw-cryo', '부식': 'kw-nature',
        '방어 불능': 'kw-phys', '강타': 'kw-phys', '띄우기': 'kw-phys', '넘어뜨리기': 'kw-phys', '강제 띄우기': 'kw-phys', '강제 넘어뜨리기': 'kw-phys', '갑옷 파괴': 'kw-phys', '오리지늄 결정': 'kw-phys',
        '일반 공격': 'kw-special', '배틀 스킬': 'kw-special', '연계 스킬': 'kw-special', '궁극기': 'kw-special',
        '불균형': 'kw-special', '치유': 'kw-nature', '보호': 'kw-nature', '비호': 'kw-nature', '연타': 'kw-special', '스킬 게이지': 'kw-special', '소모': 'kw-special', '궁극기 에너지': 'kw-special', '치명타 확률': 'kw-special', '치명타 피해': 'kw-special',
        '녹아내린 불꽃': 'kw-heat', '썬더랜스': 'kw-elec', '강력한 썬더랜스': 'kw-elec',
        '아츠 폭발': 'kw-special', '연소': 'kw-heat', '감전': 'kw-elec', '동결': 'kw-cryo', '부식': 'kw-nature',
        '재능': 'kw-desc', '잠재': 'kw-desc'
    },

    /** 속성별 대표 색상 (CSS 변수 기반) */
    ELEMENT_COLORS: {
        phys: 'var(--skill-element-phys)',
        heat: 'var(--skill-element-heat)',
        elec: 'var(--skill-element-elec)',
        cryo: 'var(--skill-element-cryo)',
        nature: 'var(--skill-element-nature)'
    },

    /** 오퍼레이터/무기의 자체 버프 효과 타입 */
    TRAIT_TYPES: [
        '공격력 증가', '물리 피해', '아츠 피해', '열기 피해', '전기 피해', '냉기 피해', '자연 피해',
        '불균형 목표에 주는 피해', '일반 공격 피해', '배틀 스킬 피해', '연계 스킬 피해', '궁극기 피해',
        '모든 스킬 피해', '주는 피해', '오리지늄 아츠 강도', '치명타 확률', '치명타 피해',
        '물리 저항 무시', '열기 저항 무시', '전기 저항 무시', '냉기 저항 무시', '자연 저항 무시',
        '스킬 치명타 확률', '스킬 치명타 피해'
    ],

    /** 파티원 또는 적 대상 시너지 효과 타입 */
    SYNERGY_TYPES: [
        '물리 증폭', '아츠 증폭', '열기 증폭', '전기 증폭', '냉기 증폭', '자연 증폭',
        '물리 취약', '아츠 취약', '열기 취약', '전기 취약', '냉기 취약', '자연 취약',
        '받는 물리 피해', '받는 아츠 피해', '받는 열기 피해', '받는 전기 피해', '받는 냉기 피해', '받는 자연 피해',
        '받는 불균형 피해', '받는 피해', '연타', '저항 감소', '감전 부여', '동결 부여', '부식 부여', '연소 부여', '방어 불능 부여', '열기 부착', '냉기 부착', '전기 부착', '자연 부착', '아츠 부착', '강타', '띄우기', '넘어뜨리기', '강제 띄우기', '강제 넘어뜨리기', '갑옷 파괴', '스킬 게이지 회복'
    ],

    /** 툴팁 상세 목록에서 제외할 보조/유틸리티 효과 */
    EXCLUDE_TYPES: ['최대 생명력', '궁극기 충전', '치유 효율', '모든 능력치', '치유', '비호', '보호'],

    WEP_TYPE_MAP: { sword: '한손검', great_sword: '양손검', polearm: '장병기', handcannon: '권총', arts_unit: '아츠 유닛' },
    GEAR_PART_MAP: { armor: '방어구', gloves: '글러브', kit: '부품' },

    // ==========================================
    // 2. 내부 유틸리티 메서드
    // ==========================================

    /** 텍스트 내 커스텀 키워드를 색상화하여 span 태그로 감싼다. */
    colorizeText(text) {
        if (!text) return text;
        const parts = text.split(/(<[^>]+>)/g);
        const keys = Object.keys(this.HIGHLIGHTS).sort((a, b) => b.length - a.length);

        return parts.map(part => {
            if (part.startsWith('<')) return part;
            let highlighted = part;
            const tokens = [];
            keys.forEach((key, idx) => {
                const regex = new RegExp(key, 'g');
                if (regex.test(highlighted)) {
                    const token = `__KW${idx}__`;
                    const val = this.HIGHLIGHTS[key];
                    const isHex = /^[0-9A-Fa-f]{6}$/.test(val);
                    const html = isHex
                        ? `<span style="color:#${val}; font-weight:bold;">${key}</span>`
                        : `<span class="${val}">${key}</span>`;

                    tokens.push({ token, html });
                    highlighted = highlighted.replace(regex, token);
                }
            });
            tokens.forEach(item => {
                highlighted = highlighted.replace(new RegExp(item.token, 'g'), item.html);
            });
            return highlighted;
        }).join('');
    },

    /** 주어진 데이터 객체에서 속성명을 한글로 추출한다. */
    getElementName(obj) {
        const element = obj.element || obj.type;
        if (element === 'phys') return '물리';
        return { heat: '열기', cryo: '냉기', elec: '전기', nature: '자연' }[element] || '아츠';
    },

    /** 오퍼레이터 데이터를 기반으로 특정 스킬 타입의 고유 속성 색상을 반환한다. */
    getSkillElementColor(opData, skillType) {
        if (!opData || !opData.skill) return this.ELEMENT_COLORS.phys;
        const skillDef = opData.skill.find(s => {
            return s.skillType && s.skillType.some(st => st.includes(skillType) || skillType.includes(st));
        });
        if (skillDef && skillDef.element) {
            return this.ELEMENT_COLORS[skillDef.element] || this.ELEMENT_COLORS.phys;
        }
        return this.ELEMENT_COLORS.phys;
    },

    getWepTypeName(type) { return this.WEP_TYPE_MAP[type] || type; },

    // ==========================================
    // 3. 생명주기 및 노출 제어
    // ==========================================

    init() {
        this.el = document.getElementById('app-tooltip');
        if (!this.el) return;

        document.addEventListener('mouseover', (e) => {
            if (window.innerWidth <= 1024) return;
            const target = e.target.closest('[data-tooltip-id]');
            if (!target) return;
            const id = target.getAttribute('data-tooltip-id');
            const type = target.getAttribute('data-tooltip-type');
            const pot = Number(target.getAttribute('data-tooltip-pot')) || 0;
            const forged = target.getAttribute('data-tooltip-forged') === 'true';
            const isModal = !!target.closest('.modal-item');
            if (id && type) this.show(id, type, pot, e, forged, isModal);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.el.style.display === 'block') this.position(e);
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('[data-tooltip-id]')) this.hide();
        });
    },

    show(id, type, pot, event, forged = false, isModal = false) {
        if (window.innerWidth <= 1024) return;
        const data = this.getData(id, type);
        if (!data) return;

        // 메인 화면 오퍼레이터 툴팁만 너비 확장
        if (type === 'operator' && !isModal) {
            this.el.style.width = '500px';
        } else {
            this.el.style.width = '';
        }

        let content = '';
        if (type === 'operator') content = this.renderOperator(data, pot, isModal);
        else if (type === 'weapon') content = this.renderWeapon(data);
        else if (type === 'gear') content = this.renderGear(data, forged);
        this.el.innerHTML = content;
        this.el.style.display = 'block';
        if (event) this.position(event);
    },

    showCustom(content, event, options = {}) {
        if (window.innerWidth <= 1024) return;
        this.el.style.width = options.width || '';
        this.el.innerHTML = content;
        this.el.style.display = 'block';
        if (event) this.position(event);
    },

    hide() { if (this.el) this.el.style.display = 'none'; },

    position(e) {
        const offset = 20; // 커서와의 간격
        const margin = 10; // 화면 끝과의 최소 여백
        const tipWidth = this.el.offsetWidth;
        const tipHeight = this.el.offsetHeight;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let x = e.clientX + offset;
        let y = e.clientY + offset;

        // 오른쪽 경계 체크: 화면을 벗어나면 커서 왼쪽으로 배치
        if (x + tipWidth + margin > winWidth) {
            x = e.clientX - tipWidth - offset;
        }

        // 왼쪽 경계 체크: 왼쪽으로 보냈는데도 화면을 벗어나면 화면 왼쪽에 붙임
        if (x < margin) {
            x = margin;
        }

        // 하단 경계 체크: 화면을 벗어나면 커서 위쪽으로 배치
        if (y + tipHeight + margin > winHeight) {
            y = e.clientY - tipHeight - offset;
        }

        // 상단 경계 체크: 위로 보냈는데도 화면을 벗어나면 화면 상단에 붙임
        if (y < margin) {
            y = margin;
        }

        // 툴팁 자체가 화면보다 큰 경우에 대한 최종 보정 (상단/좌측 고정)
        if (tipWidth + margin * 2 > winWidth) x = margin;
        if (tipHeight + margin * 2 > winHeight) y = margin;

        this.el.style.left = x + 'px';
        this.el.style.top = y + 'px';
    },

    getData(id, type) {
        if (type === 'operator') return DATA_OPERATORS.find(o => o.id === id);
        if (type === 'weapon') return DATA_WEAPONS.find(w => w.id === id);
        if (type === 'gear') return DATA_GEAR.find(g => g.id === id);
        return null;
    },

    // ==========================================
    // 4. HTML 렌더러
    // ==========================================

    /** 오퍼레이터 툴팁 HTML을 렌더링합니다. */
    renderOperator(op, currentPot, isModal = false) {
        // 오퍼레이터 특성(자체 버프) 및 시너지(파티/적 버프) 아이템을 저장할 배열
        const traitItems = [], synergyItems = [];

        /** 단일 특성/시너지 항목을 처리하여 traitItems 또는 synergyItems에 추가합니다. */
        const processSingle = (t, source, sortWeight, potLevel = null) => {
            if (!t?.type) return;
            const typeArr = (Array.isArray(t.type) ? t.type : [t.type]).map(item => {
                const obj = typeof item === 'string' ? { type: item } : { ...item };
                if (obj.val === undefined) obj.val = t.val;
                return obj;
            });
            const sLabel = Array.isArray(source) ? source.join('/') : source;
            const filteredTypeArr = typeArr.filter(e => {
                if (e.skillType) return false;
                if (t.skillType) {
                    const sourceArr = Array.isArray(source) ? source : [source];
                    if (!t.skillType.some(st => sourceArr.includes(st))) return false;
                }
                return true;
            });
            if (filteredTypeArr.length === 0) return;
            const finalDisplayArr = filteredTypeArr.filter(e => !this.EXCLUDE_TYPES.includes(e.type) && e.type !== '스탯');
            if (finalDisplayArr.length === 0) return;

            const typeIncludes = (keyword) => finalDisplayArr.some(e => e.type.includes(keyword));
            const typeStr = finalDisplayArr.map(e => {
                let suffix = '';
                const st = e.skillType || t.skillType;
                if ((e.type === '스킬 치명타 확률' || e.type === '스킬 치명타 피해' || e.type === '스킬 배율 증가') && st) {
                    const stStr = Array.isArray(st) ? st.join(', ') : st;
                    suffix = ` (${stStr})`;
                }
                return e.val !== undefined ? `${e.type}${suffix} +${e.val}` : `${e.type}${suffix}`;
            }).join(' / ');

            const isPotential = potLevel !== null;
            const isActive = isPotential ? (currentPot >= potLevel) : true;
            const isUnbalanced = typeIncludes('불균형 목표에 주는 피해');
            const item = { ...t, _typeStr: typeStr, _isUnbalanced: isUnbalanced, sourceLabel: isPotential ? `잠재${potLevel}` : sLabel, active: isActive, isPotential, sortWeight };
            const isSynergy = this.SYNERGY_TYPES.some(syn => typeIncludes(syn)) || t.target === '팀' || t.target === '적' || finalDisplayArr.some(e => e.target === '팀' || e.target === '적');
            if (isSynergy) synergyItems.push(item);
            else if (this.TRAIT_TYPES.some(tr => typeIncludes(tr))) traitItems.push(item);
        };

        /** 데이터 배열을 순회하며 processSingle 함수를 호출합니다. */
        const processData = (data, source, sortWeight, potLevel = null) => {
            if (!data) return;
            data.forEach(t => { if (t) t.forEach(sub => processSingle(sub, source, sortWeight, potLevel)); });
        };

        // 스킬, 재능, 잠재 데이터를 처리하여 특성/시너지 아이템을 분류합니다.
        if (op.skill) op.skill.forEach(s => { processData([[s]], s?.skillType || '스킬', 0); });
        if (op.talents) op.talents.forEach((t, i) => { processData([t], `재능${i + 1}`, 1); });
        if (op.potential) op.potential.forEach((p, i) => processData([p], '잠재', 2, i + 1));

        /** 특성/시너지 목록을 HTML로 렌더링합니다. */
        const renderList = (list, isSynergy = false) => {
            return [...list].sort((a, b) => a.sortWeight - b.sortWeight)
                .map(t => {
                    const valStr = !t._typeStr && t.val !== undefined ? ` +${t.val}` : '';
                    const color = isSynergy ? '#FFFA00' : 'var(--accent)';
                    const style = t.active === false ? 'color:var(--text-secondary);font-weight:normal;' : `color:${color};font-weight:bold;`;
                    return `<div style="margin-bottom:2px;${style}"><span style="color:inherit">•</span> [${t.sourceLabel}] ${t._typeStr ?? t.type}${valStr}</div>`;
                }).join('');
        };

        // 재능 설명을 추출하고 색상화합니다.
        const talentDescs = (op.talents || []).map((t, i) => {
            const entry = t.find(e => e.desc);
            return entry ? `[재능${i + 1}] ${this.colorizeText(entry.desc)}` : null;
        }).filter(Boolean);

        // 잠재 설명을 추출하고 색상화합니다.
        const potDescs = (op.potential || []).map((p, i) => {
            const entry = p.find(e => e.desc);
            return entry ? `[잠재${i + 1}] ${this.colorizeText(entry.desc)}` : null;
        }).filter(Boolean);

        const descHtml = [...talentDescs, ...potDescs].join('<br>');

        return `
            <div class="tooltip-header">
                <div class="tooltip-icon"><img src="images/operators/${op.name}.webp"></div>
                <div class="tooltip-title-group">
                    <div class="tooltip-name">${op.name}</div>
                    <div class="tooltip-sub">${this.getElementName(op)} / ${this.getWepTypeName(op.usableWeapons[0])}</div>
                </div>
            </div>
            <div class="tooltip-section">
                <div class="tooltip-label">기초 능력치</div>
                <div class="tooltip-stat-grid">
                    <div class="tooltip-stat-item"><span class="tooltip-stat-key">공격력</span><span class="tooltip-stat-val">${op.baseAtk || 0}</span></div>
                    <div class="tooltip-stat-item"><span class="tooltip-stat-key">${getStatName(op.mainStat)}</span><span class="tooltip-stat-val">${op.stats?.[op.mainStat] ?? 0}</span></div>
                    <div class="tooltip-stat-item"><span class="tooltip-stat-key">${getStatName(op.subStat)}</span><span class="tooltip-stat-val">${op.stats?.[op.subStat] ?? 0}</span></div>
                </div>
            </div>
            ${traitItems.length > 0 ? `<div class="tooltip-section"><div class="tooltip-label">오퍼레이터 특성</div><div class="tooltip-traits">${renderList(traitItems)}</div></div>` : ''}
            ${synergyItems.length > 0 ? `<div class="tooltip-section"><div class="tooltip-label" style="color:#FFFA00">시너지</div><div class="tooltip-traits">${renderList(synergyItems, true)}</div></div>` : ''}
            ${!isModal && descHtml ? `<div class="tooltip-section"><div class="tooltip-label">설명</div><div class="tooltip-desc">${descHtml}</div></div>` : ''}
        `;
    },

    /** 무기 툴팁 HTML을 렌더링합니다. */
    renderWeapon(wep) {
        // 무기 특성(자체 버프) 및 시너지(파티/적 버프) 아이템을 저장할 배열
        const traitItems = [], synergyItems = [];
        wep.traits.forEach((t) => {
            const typeArr = (Array.isArray(t.type) ? t.type : [t.type]).map(item => typeof item === 'string' ? { type: item } : item);
            const types = typeArr.map(e => e.type);
            const isStatTrait = types.includes('스탯');
            let label = isStatTrait ? getStatName(t.stat) : types[0];
            if (t.skillType && t.skillType.length > 0) label += ` (${t.skillType.join(', ')})`;

            const fmt = (v) => {
                if (typeof v === 'number') return (v > 0 ? '+' : '') + v;
                if (typeof v === 'string') return (!v.startsWith('+') && !v.startsWith('-')) ? '+' + v : v;
                return v;
            };

            let rangeStr = (t.valByLevel?.length > 0)
                ? `${label} ${fmt(t.valByLevel[0])} ~ ${fmt(t.valByLevel[t.valByLevel.length - 1])}`
                : `${label} ${fmt(t.val || 0)}`;

            if (t.stack) rangeStr += ` (최대 ${t.stack}중첩)`;

            const isSynergy = (t.target === '팀' || t.target === '적' || types.some(tt => this.SYNERGY_TYPES.some(syn => String(tt).includes(syn))));
            const isUnbalanced = types.includes('불균형 목표에 주는 피해') && !state?.enemyUnbalanced;
            const bulletColor = isUnbalanced ? 'inherit' : isSynergy ? '#FFFA00' : 'var(--accent)';
            const html = `<div style="margin-bottom:2px;${isUnbalanced ? 'color:inherit;' : ''}"><span style="color:${bulletColor}">•</span> ${rangeStr}</div>`;
            if (isSynergy) synergyItems.push(html); else traitItems.push(html);
        });

        const lastTrait = wep.traits[wep.traits.length - 1];
        const traitDesc = (lastTrait && lastTrait.desc) ? this.colorizeText(lastTrait.desc) : '';

        return `
            <div class="tooltip-header">
                <div class="tooltip-icon"><img src="images/weapons/${wep.name}.webp"></div>
                <div class="tooltip-title-group">
                    <div class="tooltip-name">${wep.name}</div>
                    <div class="tooltip-sub">${this.getWepTypeName(wep.type)}</div>
                </div>
            </div>
            <div class="tooltip-section">
                <div class="tooltip-label">기초 능력치</div>
                <div class="tooltip-stat-grid">
                    <div class="tooltip-stat-item"><span class="tooltip-stat-key">공격력</span><span class="tooltip-stat-val">${wep.baseAtk}</span></div>
                </div>
            </div>
            ${traitItems.length > 0 ? `<div class="tooltip-section"><div class="tooltip-label">무기 특성</div><div class="tooltip-traits">${traitItems.join('')}</div>${traitDesc ? `<div class="tooltip-desc" style="margin-top:8px;">${traitDesc}</div>` : ''}</div>` : ''}
            ${synergyItems.length > 0 ? `<div class="tooltip-section"><div class="tooltip-label" style="color:#FFFA00">시너지</div><div class="tooltip-traits">${synergyItems.join('')}</div></div>` : ''}
        `;


    },

    /** 장비 툴팁 HTML을 렌더링합니다. */
    renderGear(gear, forged = false) {
        const setName = DATA_SETS?.find(s => s.id === gear.set)?.name || '일반';
        const valStyle = forged ? 'style="color:var(--accent);font-weight:bold;"' : '';
        const stats = [];
        if (gear.stat1) stats.push({ type: gear.stat1, val: forged && gear.val1_f !== undefined ? gear.val1_f : gear.val1 });
        if (gear.stat2) stats.push({ type: gear.stat2, val: forged && gear.val2_f !== undefined ? gear.val2_f : gear.val2 });

        const statsHtml = stats.map(s =>
            `<div class="tooltip-stat-item"><span class="tooltip-stat-key">${getStatName(s.type)}</span><span class="tooltip-stat-val" ${valStyle}>+${Math.floor(s.val)}</span></div>`
        ).join('');

        // 장비 특성 HTML을 렌더링합니다.
        let traitHtml = '';
        if (gear.trait) {
            const traitLines = (gear.trait || []).map(t => {
                const typeArr = (Array.isArray(t.type) ? t.type : [t.type]).map(item => typeof item === 'string' ? { type: item } : item);
                const types = typeArr.map(e => e.type);
                const isStatTrait = types.includes('스탯');
                const v = forged && t.val_f !== undefined ? t.val_f : t.val;

                let valStr = '';
                if (v !== undefined) {
                    if (typeof v === 'number') valStr = (v > 0 ? ' +' : ' ') + v.toFixed(1);
                    else valStr = String(v).startsWith('+') || String(v).startsWith('-') ? ' ' + v : ' +' + v;
                }

                const isUnbalanced = types.includes('불균형 목표에 주는 피해') && !state?.enemyUnbalanced;
                const accentColor = isUnbalanced ? 'inherit' : 'var(--accent)';
                const spanStyle = (!isUnbalanced && forged) ? `style="color:var(--accent);font-weight:bold;"` : '';
                const label = isStatTrait ? getStatName(t.stat) : types[0];
                return `<div style="margin-bottom:2px;${isUnbalanced ? 'color:inherit;' : ''}"><span style="color:${accentColor}">•</span> ${label}<span ${spanStyle}>${valStr}</span></div>`;
            }).join('');
            traitHtml = `<div class="tooltip-section"><div class="tooltip-label">장비 특성</div><div class="tooltip-desc">${traitLines}</div></div>`;
        }

        return `
            <div class="tooltip-header">
                <div class="tooltip-icon"><img src="images/gears/${gear.name}.webp"></div>
                <div class="tooltip-title-group">
                    <div class="tooltip-name">${gear.name}</div>
                    <div class="tooltip-sub">${this.GEAR_PART_MAP[gear.part] || gear.part} / ${setName}</div>
                </div>
            </div>
            <div class="tooltip-section">
                <div class="tooltip-label">장비 스탯</div>
                <div class="tooltip-stat-grid">${statsHtml}</div>
            </div>
            ${traitHtml}
        `;
    },

    /** 스킬 툴팁 HTML을 렌더링합니다. */
    renderSkillTooltip(skillType, skillData, opData, extraHtml = '', activeEffects = [], st = null) {
        if (!skillData) return '';
        const entry = skillData;
        const attrLines = [];

        const element = this.getElementName(entry.element ? entry : opData);
        if (element) attrLines.push(`<div class="tooltip-bullet-point"><span class="tooltip-bullet-marker accent">•</span> 공격 속성: ${element}</div>`);
        if (skillType === '궁극기' && entry.cost !== undefined) attrLines.push(`<div class="tooltip-bullet-point"><span class="tooltip-bullet-marker">•</span> 궁극기 게이지: ${entry.cost}</div>`);

        if (entry.type) {
            const typeStrs = (Array.isArray(entry.type) ? entry.type : [entry.type]).map(t => {
                if (typeof t === 'string') return t;
                if (typeof t === 'object' && t !== null && t.type) {
                    if (t.skillType) return null;
                    const tName = Array.isArray(t.type) ? t.type[0] : t.type;
                    return t.val ? `${tName} +${t.val}` : tName;
                }
                return '';
            }).filter(Boolean);
            if (typeStrs.length > 0) attrLines.push(`<div class="tooltip-bullet-point"><span class="tooltip-bullet-marker">•</span> ${typeStrs.join(' / ')}</div>`);
        }

        if (entry.dmg && parseInt(entry.dmg, 10) > 0) {
            let dmgStr = `기본 데미지: <strong class="tooltip-highlight">${entry.dmg}</strong>`;
            if (entry.bonus) {
                dmgStr += (entry.bonus || []).map(b => {
                    const triggerLines = (b.trigger || []).join(', ');
                    let bValStr =
                        b.val !== undefined && b.val !== '0%' ? '+' + b.val :
                            b.perStack !== undefined && b.perStack !== '0%' ?
                                (b.base && b.base !== '0%' ? `${b.base} + ${b.perStack}/스택` : `${b.perStack}/스택`) : // perStack이 있을때
                                (b.base && b.base !== '0%' ? b.base : ''); // perStack이 없을때
                    return bValStr ? ` <span class="tooltip-muted">+ ${triggerLines} <strong class="tooltip-highlight">${bValStr}</strong></span>` : '';
                }).filter(Boolean).join('');
            }
            attrLines.push(`<div class="tooltip-bullet-point"><span class="tooltip-bullet-marker">•</span> ${dmgStr}</div>`);
        }

        const synergyHtml = this.renderSynergySection(activeEffects, st, opData, skillType);
        if (synergyHtml) attrLines.push(synergyHtml);

        return `<div class="tooltip-title">${skillType}</div>${extraHtml ? `<div class="tooltip-group">${extraHtml}</div>` : ''}${attrLines.length > 0 ? `<div class="tooltip-section tooltip-group">${attrLines.join('')}</div>` : ''}<div class="tooltip-desc">${this.colorizeText(entry.desc || '설명 없음')}</div>`;
    },

    /** 시퀀스 아이템 전용 간소화된 툴팁을 렌더링합니다. */
    renderSequenceTooltip(type, displayDmg, rateHtml, activeEffects, st, opData) {
        const extraHtml = `
            <div class="tooltip-desc">피해량: <strong class="tooltip-highlight">${Math.floor(displayDmg).toLocaleString()}</strong><br>데미지 배율: <strong>${rateHtml}</strong></div>
        `;

        const synergyHtml = this.renderSynergySection(activeEffects, st, opData, type);

        return `
            <div class="tooltip-title tooltip-highlight">${type}</div>
            <div class="tooltip-group">${extraHtml}</div>
            ${synergyHtml ? `<div class="tooltip-section tooltip-group">${synergyHtml}</div>` : ''}
        `;
    },

    /** 적용 중인 추가 효과(시너지) 섹션을 렌더링합니다. (스킬 툴팁 내부용) */
    renderSynergySection(activeEffects, st, opData, skillType) {
        const typeMap = { '배틀 스킬': 'battle', '연계 스킬': 'combo', '궁극기': 'ult', '일반 공격': 'normal' };
        const catKey = typeMap[skillType] || (skillType.includes('일반 공격') ? 'normal' : (skillType.includes('배틀 스킬') ? 'battle' : 'common'));

        // 현재 스킬 타입에 맞는 활성화된 효과만 필터링합니다.
        const filteredEffects = activeEffects.filter(eff => {
            const stTypes = eff.skillType || [];
            const t = Array.isArray(eff.type) ? eff.type[0] : eff.type;

            // 실시간 동기화: 현재 카테고리(catKey) 기준으로 비활성화 여부 재확인
            if (st?.disabledEffects) {
                const uiUid = `${eff.uid}#${catKey}`;
                if (st.disabledEffects.includes(uiUid) || st.disabledEffects.includes(`${eff.uid}#common`)) return false;
            }

            if (eff._isExternal && stTypes.includes(skillType)) {
                return t.endsWith('피해') || t.includes('피해') || t.includes('공격력') || t.includes('배율') || t.includes('치명타');
            }
            const isNormal = skillType === '일반 공격' || skillType.includes('강화 일반 공격');
            const isBattle = skillType === '배틀 스킬' || skillType.includes('강화 배틀 스킬');
            const isCombo = skillType === '연계 스킬', isUlt = skillType === '궁극기';
            if (isNormal && t === '일반 공격 피해') return true;
            if (isBattle && t === '배틀 스킬 피해') return true;
            if (isCombo && t === '연계 스킬 피해') return true;
            if (isUlt && t === '궁극기 피해') return true;
            if ((isBattle || isCombo || isUlt) && (t === '모든 스킬 피해' || t === '스킬 배율 증가')) return stTypes.length === 0 || stTypes.includes(skillType);
            return false;
        }).sort((a, b) => {
            const ta = Array.isArray(a.type) ? a.type[0] : a.type;
            const tb = Array.isArray(b.type) ? b.type[0] : b.type;

            const isAllSkillA = ta === '모든 스킬 피해';
            const isAllSkillB = tb === '모든 스킬 피해';
            if (isAllSkillA && !isAllSkillB) return -1;
            if (!isAllSkillA && isAllSkillB) return 1;

            if (ta === '스킬 배율 증가' && tb !== '스킬 배율 증가') return 1;
            if (ta !== '스킬 배율 증가' && tb === '스킬 배율 증가') return -1;
            return 0;
        });

        // 추가적인 효과(디버프, 특수 스택 등)를 수집합니다.
        const extraEffects = [];
        if (st?.debuffState) {
            const ds = st.debuffState;
            if (ds.physDebuff) {
                if (ds.physDebuff.defenseless > 0) extraEffects.push(`방어 불능 ${ds.physDebuff.defenseless}스택`);
                if (ds.physDebuff.armorBreak > 0) extraEffects.push(`갑옷 파괴 ${ds.physDebuff.armorBreak}스택`);
                if (ds.physDebuff.combo > 0) {
                    const m = (skillType === '배틀 스킬' || skillType.includes('강화 배틀 스킬')) ? [0, 1.3, 1.45, 1.6, 1.75] : (skillType === '궁극기' ? [0, 1.2, 1.3, 1.4, 1.5] : null);
                    extraEffects.push(m ? `연타 *${m[Math.min(ds.physDebuff.combo, 4)].toFixed(2)}배` : `연타 ${ds.physDebuff.combo}스택`);
                }
            }
            if (ds.artsAttach?.type && ds.artsAttach.stacks > 0) extraEffects.push(`${ds.artsAttach.type} ${ds.artsAttach.stacks}스택`);
            if (ds.artsAbnormal) Object.entries(ds.artsAbnormal).forEach(([n, s]) => { if (s > 0) extraEffects.push(`${n} ${s}스택`); });
        }
        if (st?.mainOp?.specialStack && opData?.specialStack) {
            (Array.isArray(opData.specialStack) ? opData.specialStack : [opData.specialStack]).forEach(s => {
                const c = st.mainOp.specialStack[s.id || 'default'] || 0;
                if (c > 0) extraEffects.push(`${s.name} ${c}스택`);
            });
        }
        if (st && skillType) {
            const opDataLocal = opData || (typeof DATA_OPERATORS !== 'undefined' ? DATA_OPERATORS.find(o => o.id === st.mainOp.id) : null);
            if (opDataLocal) {
                const skillDef = opDataLocal.skill?.find(s => s.skillType?.includes(skillType));
                if (skillDef && skillDef.bonus) {
                    (Array.isArray(skillDef.bonus) ? skillDef.bonus : [skillDef.bonus]).forEach(b => {
                        if (b.trigger && evaluateTrigger(b.trigger, st, opDataLocal, null, false, null, true)) {
                            const triggerTxt = Array.isArray(b.trigger) ? b.trigger.join(', ') : b.trigger;
                            // 스페셜 스택과 이름이 겹치면 (보너스 발동) 라인은 생략
                            const isAlreadyShown = extraEffects.some(ee => ee.includes(triggerTxt));
                            if (!isAlreadyShown) {
                                extraEffects.push(`${triggerTxt} (보너스 발동)`);
                            }
                        }
                    });
                }
            }
        }

        if (filteredEffects.length === 0 && extraEffects.length === 0) return '';

        let html = '<div style="margin-top:8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top:8px;"></div>';
        html += '<div class="tooltip-label" color:var(--accent); margin-bottom:4px;">적용 중인 추가 효과</div>';
        filteredEffects.forEach(eff => {
            const t = Array.isArray(eff.type) ? eff.type[0] : eff.type;
            let val = eff.val !== undefined ? eff.val : eff.dmg;
            let valStr = '';
            if (val !== undefined) {
                if (t === '스킬 배율 증가') {
                    // 합연산(dmg)인지 곱연산(val)인지 확인
                    if (eff.dmg !== undefined) {
                        valStr = ` +${eff.dmg}`;
                    } else {
                        const n = parseFloat(val) || 0;
                        valStr = ` *${(1 + n / 100).toFixed(2)}`;
                    }
                } else {
                    valStr = ` +${val}`;
                }
            }
            html += `<div class="tooltip-bullet-point" style="color:var(--accent);"><span class="tooltip-bullet-marker">•</span> ${t}${valStr}</div>`;
        });
        extraEffects.forEach(txt => {
            html += `<div class="tooltip-bullet-point" style="color:#FFFA00;"><span class="tooltip-bullet-marker">•</span> ${txt}</div>`;
        });
        return html;
    },

    /** 물리 이상 또는 아츠 이상/폭발 툴팁을 렌더링한다. */
    renderAbnormalTooltip(aName, artsStrength = 0, st = null) {
        /** 이상 상태 데이터를 이름으로 찾습니다. */
        const getAbnormalData = (name) => {
            if (typeof DATA_ABNORMALS === 'undefined') return null;
            // 1. 정확한 이름 매칭
            if (DATA_ABNORMALS[name]) return DATA_ABNORMALS[name];
            // 2. '(이상)' 접미사 제거 후 매칭 (예: '연소(이상)' -> '연소')
            const baseName = name.replace('(이상)', '');
            if (DATA_ABNORMALS[baseName]) return DATA_ABNORMALS[baseName];
            return null;
        };

        const data = getAbnormalData(aName);
        let desc = '설명 없음';
        let attrLines = [];
        // 이상 상태에 적용되는 시너지(디버프) 효과를 저장할 배열
        let synergyLines = [];

        if (data) {
            desc = data.desc;

            // 속성 표시
            const elementMap = { phys: '물리', heat: '열기', elec: '전기', cryo: '냉기', nature: '자연', arts: '아츠(속성 일치)' };
            const elName = elementMap[data.element] || data.element;
            if (elName) {
                attrLines.push(`<div class="tooltip-bullet-point"><span class="tooltip-bullet-marker accent">•</span> 공격 속성: ${elName}</div>`);
            }

            // 데미지 표시
            if (data.base) {
                const multiplier = 1 + (artsStrength / 100);
                const parseVal = (str) => parseFloat(str.replace('%', '')) || 0;

                const finalBase = (parseVal(data.base) * multiplier).toFixed(0) + '%';
                let dmgStr = `기본 데미지: <strong class="tooltip-highlight">${finalBase}</strong>`;

                if (data.perStack) {
                    const finalPerStack = (parseVal(data.perStack) * multiplier).toFixed(0) + '%';
                    dmgStr += ` <span class="tooltip-muted">+ ${data.trigger || '스택'} * <strong class="tooltip-highlight">${finalPerStack}</strong></span>`;
                }
                attrLines.push(`<div class="tooltip-bullet-point"><span class="tooltip-bullet-marker">•</span> ${dmgStr}</div>`);
            }

            // 시너지(디버프) 정보 추가
            if (st?.debuffState) {
                const ds = st.debuffState;
                const isPhys = data.element === 'phys';
                const isArts = ['heat', 'elec', 'cryo', 'nature'].includes(data.element);

                // 방어 불능 (모든 이상 데미지 공통 적용으로 추정되나 보통 물리 데미지 비중이 큼, 여기서는 공통 표시)
                if (ds.physDebuff?.defenseless > 0) synergyLines.push(`방어 불능 ${ds.physDebuff.defenseless}스택`);

                // 갑옷 파괴 (물리만)
                if (isPhys && ds.physDebuff?.armorBreak > 0) synergyLines.push(`갑옷 파괴 ${ds.physDebuff.armorBreak}단계`);

                // 감전 (아츠만)
                if (isArts && ds.artsAbnormal?.['감전'] > 0) synergyLines.push(`감전 ${ds.artsAbnormal['감전']}단계 (받는 아츠 피해 증가)`);

                // 부식 (모든 속성 저항 감소이므로 공통)
                if (ds.artsAbnormal?.['부식'] > 0) synergyLines.push(`부식 ${ds.artsAbnormal['부식']}단계 (모든 저항 감소)`);
            }
        }

        let html = `<div class="tooltip-title">${aName}</div>`;

        if (attrLines.length > 0) {
            html += `<div class="tooltip-section tooltip-group">${attrLines.join('')}</div>`;
        }

        if (synergyLines.length > 0 || artsStrength > 0) {
            html += `<div style="margin-top:8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top:8px;"></div>`;
            html += `<div class="tooltip-label" color:var(--accent); margin-bottom:4px;">적용 중인 추가 효과</div>`;

            if (artsStrength > 0) {
                html += `<div class="tooltip-bullet-point" style="color:var(--accent);"><span class="tooltip-bullet-marker">•</span> 오리지늄 아츠 강도 +${artsStrength.toFixed(1)}%</div>`;
            }

            synergyLines.forEach(txt => {
                html += `<div class="tooltip-bullet-point" style="color:#FFFA00;"><span class="tooltip-bullet-marker">•</span> ${txt}</div>`;
            });
        }

        html += `<div class="tooltip-desc">${this.colorizeText(desc)}</div>`;

        return html;
    }
};
