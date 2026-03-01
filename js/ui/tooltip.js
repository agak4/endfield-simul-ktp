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

    /** 텍스트 내 키워드 하이라이트 매핑 (CSS 클래스명) */
    HIGHLIGHTS: {
        '공격력': 'kw-special',
        '모든 피해': 'kw-special', '물리 피해': 'kw-phys', '아츠 피해': 'kw-arts', '열기 피해': 'kw-heat', '전기 피해': 'kw-elec', '냉기 피해': 'kw-cryo', '자연 피해': 'kw-nature',
        '받는 물리 피해': 'kw-phys', '받는 아츠 피해': 'kw-arts', '받는 열기 피해': 'kw-heat', '받는 전기 피해': 'kw-elec', '받는 냉기 피해': 'kw-cryo', '받는 자연 피해': 'kw-nature',
        '물리 취약': 'kw-special', '아츠 취약': 'kw-special', '열기 취약': 'kw-heat', '전기 취약': 'kw-elec', '냉기 취약': 'kw-cryo', '자연 취약': 'kw-nature',
        '열기 부착': 'kw-heat', '전기 부착': 'kw-elec', '냉기 부착': 'kw-cryo', '자연 부착': 'kw-nature',
        '연소': 'kw-heat', '감전': 'kw-elec', '동결': 'kw-cryo', '부식': 'kw-nature',
        '방어 불능': 'kw-phys', '강타': 'kw-phys', '띄우기': 'kw-phys', '넘어뜨리기': 'kw-phys', '강제 띄우기': 'kw-phys', '강제 넘어뜨리기': 'kw-phys', '갑옷 파괴': 'kw-phys', '오리지늄 결정': 'kw-phys',
        '쇄빙': 'kw-phys',
        '일반 공격': 'kw-special', '배틀 스킬': 'kw-special', '연계 스킬': 'kw-special', '궁극기': 'kw-special',
        '불균형': 'kw-special', '치유': 'kw-nature', '보호': 'kw-nature', '비호': 'kw-nature', '연타': 'kw-special', '스킬 게이지': 'kw-special', '소모': 'kw-special', '궁극기 에너지': 'kw-special', '궁극기 충전 효율': 'kw-special', '치명타 확률': 'kw-special', '치명타 피해': 'kw-special',
        '녹아내린 불꽃': 'kw-heat', '썬더랜스': 'kw-elec', '강력한 썬더랜스': 'kw-elec',
        '아츠 폭발': 'kw-special',
        '재능': 'kw-desc', '잠재': 'kw-desc',
    },

    /** 속성별 대표 색상 (CSS 변수 기반) */
    ELEMENT_COLORS: {
        phys: 'var(--skill-element-phys)',
        heat: 'var(--skill-element-heat)',
        elec: 'var(--skill-element-elec)',
        cryo: 'var(--skill-element-cryo)',
        nature: 'var(--skill-element-nature)',
    },

    /** 오퍼레이터/무기의 자체 버프 효과 타입 */
    TRAIT_TYPES: [
        '공격력 증가', '물리 피해', '아츠 피해', '열기 피해', '전기 피해', '냉기 피해', '자연 피해',
        '불균형 목표에 주는 피해', '일반 공격 피해', '배틀 스킬 피해', '연계 스킬 피해', '궁극기 피해',
        '모든 스킬 피해', '주는 피해', '오리지늄 아츠 강도', '치명타 확률', '치명타 피해',
        '물리 저항 무시', '열기 저항 무시', '전기 저항 무시', '냉기 저항 무시', '자연 저항 무시',
        '스킬 치명타 확률', '스킬 치명타 피해',
    ],

    /** 파티원 또는 적 대상 시너지 효과 타입 */
    SYNERGY_TYPES: [
        '물리 증폭', '아츠 증폭', '열기 증폭', '전기 증폭', '냉기 증폭', '자연 증폭',
        '물리 취약', '아츠 취약', '열기 취약', '전기 취약', '냉기 취약', '자연 취약',
        '받는 물리 피해', '받는 아츠 피해', '받는 열기 피해', '받는 전기 피해', '받는 냉기 피해', '받는 자연 피해',
        '받는 불균형 피해', '받는 피해', '연타', '저항 감소', '감전 부여', '동결 부여', '부식 부여', '연소 부여', '방어 불능 부여',
        '열기 부착', '냉기 부착', '전기 부착', '자연 부착', '아츠 부착',
        '강타', '띄우기', '넘어뜨리기', '강제 띄우기', '강제 넘어뜨리기', '갑옷 파괴', '스킬 게이지 회복',
    ],

    /** 툴팁 상세 목록에서 제외할 보조/유틸리티 효과 */
    EXCLUDE_TYPES: ['최대 생명력', '궁극기 충전', '치유 효율', '모든 능력치', '치유', '비호', '보호'],

    WEP_TYPE_MAP: { sword: '한손검', great_sword: '양손검', polearm: '장병기', handcannon: '권총', arts_unit: '아츠 유닛' },
    GEAR_PART_MAP: { armor: '방어구', gloves: '글러브', kit: '부품' },

    /** 스킬 타입 → 내부 카테고리 키 매핑 */
    SKILL_TYPE_MAP: {
        '배틀 스킬': 'battle',
        '연계 스킬': 'combo',
        '궁극기': 'ult',
        '일반 공격': 'normal',
    },

    /** 속성 키 → 한글 이름 매핑 */
    ELEMENT_NAME_MAP: { phys: '물리', heat: '열기', cryo: '냉기', elec: '전기', nature: '자연' },

    // ==========================================
    // 2. 내부 유틸리티 메서드
    // ==========================================

    /**
     * 값 앞에 부호(+/-)를 붙여 표시 문자열로 변환한다.
     * renderWeapon과 renderGear에서 공통으로 사용한다.
     * @param {number|string} v
     * @returns {string}
     */
    fmtVal(v) {
        if (typeof v === 'number') return (v > 0 ? '+' : '') + v;
        if (typeof v === 'string') return (!v.startsWith('+') && !v.startsWith('-')) ? '+' + v : v;
        return String(v ?? '');
    },

    /**
     * type 필드를 `{type, val?}` 객체 배열로 정규화한다.
     * `Array.isArray(t.type) ? ... : [t.type]` 패턴을 대체한다.
     * @param {string|object|Array} type
     * @returns {Array<{type:string, [key:string]:any}>}
     */
    normalizeTypeArr(type) {
        return (Array.isArray(type) ? type : [type])
            .map(item => typeof item === 'string' ? { type: item } : item);
    },

    /**
     * 단일 툴팁 불릿 라인 HTML을 생성한다.
     * `<div class="tooltip-bullet-point">` 패턴을 공통화한다.
     * @param {string} content - 불릿 오른쪽에 표시될 HTML 문자열
     * @param {string} markerColor - 불릿(•) 색상 (기본: 'inherit')
     * @param {string} lineStyle - 줄 전체에 적용할 추가 인라인 스타일
     * @returns {string}
     */
    makeBulletLine(content, markerColor = 'inherit', lineStyle = '') {
        return `<div class="tooltip-bullet-point"${lineStyle ? ` style="${lineStyle}"` : ''}><span class="tooltip-bullet-marker" style="color:${markerColor}">•</span> ${content}</div>`;
    },

    /**
     * 섹션 wrapper HTML을 생성한다.
     * @param {string} label - 섹션 제목
     * @param {string} bodyHtml - 섹션 본문 HTML
     * @param {string} labelStyle - 제목에 적용할 추가 인라인 스타일
     * @returns {string}
     */
    makeSection(label, bodyHtml, labelStyle = '') {
        return `<div class="tooltip-section"><div class="tooltip-label"${labelStyle ? ` style="${labelStyle}"` : ''}>${label}</div>${bodyHtml}</div>`;
    },

    /**
     * 텍스트 내 커스텀 키워드를 색상화하여 span 태그로 감싼다.
     * @param {string} text
     * @returns {string}
     */
    colorizeText(text) {
        if (!text) return text;
        const keys = Object.keys(this.HIGHLIGHTS).sort((a, b) => b.length - a.length);

        return text.split(/(<[^>]+>)/g).map(part => {
            if (part.startsWith('<')) return part;

            let result = part;
            const tokens = [];
            keys.forEach((key, idx) => {
                const regex = new RegExp(key, 'g');
                if (!regex.test(result)) return;
                const token = `__KW${idx}__`;
                const val = this.HIGHLIGHTS[key];
                const html = /^[0-9A-Fa-f]{6}$/.test(val)
                    ? `<span style="color:#${val}; font-weight:bold;">${key}</span>`
                    : `<span class="${val}">${key}</span>`;
                tokens.push({ token, html });
                result = result.replace(new RegExp(key, 'g'), token);
            });
            tokens.forEach(({ token, html }) => { result = result.replace(new RegExp(token, 'g'), html); });
            return result;
        }).join('');
    },

    /**
     * 데이터 객체의 element/type 필드로 한글 속성명을 반환한다.
     * @param {object} obj - element 또는 type 필드를 가진 데이터 객체
     * @returns {string}
     */
    getElementName(obj) {
        return this.ELEMENT_NAME_MAP[obj.element || obj.type] || '아츠';
    },

    /**
     * 오퍼레이터의 특정 스킬 타입에 해당하는 속성 색상을 반환한다.
     * @param {object} opData
     * @param {string} skillType
     * @returns {string} CSS 색상 값
     */
    getSkillElementColor(opData, skillType) {
        const skillDef = opData?.skill?.find(s => s.skillType?.some(st => st.includes(skillType) || skillType.includes(st)));
        return this.ELEMENT_COLORS[skillDef?.element] || this.ELEMENT_COLORS.phys;
    },

    /** @param {string} type @returns {string} */
    getWepTypeName(type) { return this.WEP_TYPE_MAP[type] || type; },

    // ==========================================
    // 3. 생명주기 및 노출 제어
    // ==========================================

    /**
     * 툴팁 시스템을 초기화하고 전역 이벤트 리스너를 등록한다.
     * mouseover → show, mousemove → position, mouseout → hide
     */
    init() {
        this.el = document.getElementById('app-tooltip');
        if (!this.el) return;

        document.addEventListener('mouseover', (e) => {
            if (window.innerWidth <= 1024) return;
            const target = e.target.closest('[data-tooltip-id]');
            if (!target) return;
            const id = target.getAttribute('data-tooltip-id');
            const type = target.getAttribute('data-tooltip-type');
            if (id && type) this.show(id, type, Number(target.getAttribute('data-tooltip-pot')) || 0, e, target.getAttribute('data-tooltip-forged') === 'true', !!target.closest('.modal-item'));
        });

        document.addEventListener('mousemove', (e) => {
            if (this.el.style.display === 'block') this.position(e);
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('[data-tooltip-id]')) this.hide();
        });
    },

    /**
     * 특정 엔티티의 툴팁을 표시한다.
     * @param {string} id - 엔티티 ID
     * @param {string} type - 엔티티 타입 ('operator', 'weapon', 'gear')
     * @param {number} pot - 잠재 단계
     * @param {Event}  event - 마우스 이벤트
     * @param {boolean} forged - 장비 단조 여부
     * @param {boolean} isModal - 모달에서 표시되는지 여부
     */
    show(id, type, pot, event, forged = false, isModal = false) {
        if (window.innerWidth <= 1024) return;
        const data = this.getData(id, type);
        if (!data) return;

        // 메인 화면 오퍼레이터 툴팁만 너비 확장
        this.el.style.width = (type === 'operator' && !isModal) ? '500px' : '';

        let content = '';
        if (type === 'operator') content = this.renderOperator(data, pot, isModal);
        else if (type === 'weapon') content = this.renderWeapon(data);
        else if (type === 'gear') content = this.renderGear(data, forged);

        this.el.innerHTML = content;
        this.el.style.display = 'block';
        if (event) this.position(event);
    },

    /**
     * 임의의 HTML 문자열로 툴팁을 표시한다. (스킬/시퀀스 툴팁 등 외부 호출용)
     * @param {string} content
     * @param {MouseEvent} event
     * @param {object} options
     */
    showCustom(content, event, options = {}) {
        if (window.innerWidth <= 1024) return;
        this.el.style.width = options.width || '';
        this.el.innerHTML = content;
        this.el.style.display = 'block';
        if (event) this.position(event);
    },

    /** 툴팁을 숨긴다. */
    hide() { if (this.el) this.el.style.display = 'none'; },

    /**
     * 마우스 커서 위치를 기반으로 툴팁 위치를 계산하고 적용한다.
     * 화면 경계를 벗어나면 반대쪽 또는 화면 끝에 붙인다.
     * @param {MouseEvent} e
     */
    position(e) {
        const OFFSET = 20, MARGIN = 10;
        const { offsetWidth: tipW, offsetHeight: tipH } = this.el;
        const { innerWidth: winW, innerHeight: winH } = window;

        let x = e.clientX + OFFSET;
        let y = e.clientY + OFFSET;

        if (x + tipW + MARGIN > winW) x = e.clientX - tipW - OFFSET;
        if (x < MARGIN) x = MARGIN;
        if (y + tipH + MARGIN > winH) y = e.clientY - tipH - OFFSET;
        if (y < MARGIN) y = MARGIN;

        // 툴팁 자체가 화면보다 큰 경우 상단/좌측에 고정
        if (tipW + MARGIN * 2 > winW) x = MARGIN;
        if (tipH + MARGIN * 2 > winH) y = MARGIN;

        this.el.style.left = x + 'px';
        this.el.style.top = y + 'px';
    },

    /**
     * 타입에 맞는 데이터 객체를 반환한다.
     * @param {string} id
     * @param {string} type
     * @returns {object|null}
     */
    getData(id, type) {
        if (type === 'operator') return DATA_OPERATORS.find(o => o.id === id);
        if (type === 'weapon') return DATA_WEAPONS.find(w => w.id === id);
        if (type === 'gear') return DATA_GEAR.find(g => g.id === id);
        return null;
    },

    // ==========================================
    // 4. HTML 렌더러
    // ==========================================

    /**
     * 오퍼레이터 툴팁 HTML을 렌더링한다.
     * 스킬/재능/잠재의 효과를 TRAIT_TYPES와 SYNERGY_TYPES 기준으로 분류하여 표시한다.
     * @param {object} op - 오퍼레이터 데이터
     * @param {number} currentPot - 현재 잠재 단계
     * @param {boolean} isModal
     * @returns {string}
     */
    renderOperator(op, currentPot, isModal = false) {
        const traitItems = [], synergyItems = [];

        /**
         * 단일 효과 객체를 평가하여 traitItems 또는 synergyItems에 분류한다.
         * @param {object} t - 단일 효과 데이터
         * @param {string|Array} source - 효과 출처 레이블
         * @param {number} sortWeight - 정렬 가중치
         * @param {number|null} potLevel - 잠재 단계 (잠재 효과인 경우)
         */
        const processSingle = (t, source, sortWeight, potLevel = null) => {
            if (!t?.type) return;

            const typeArr = this.normalizeTypeArr(t.type).map(obj => ({ val: t.val, ...obj }));
            const sourceArr = Array.isArray(source) ? source : [source];

            const filteredTypeArr = typeArr
                .filter(e => {
                    if (e.skillType) return false;
                    if (t.skillType && !t.skillType.some(st => sourceArr.includes(st))) return false;
                    return !this.EXCLUDE_TYPES.includes(e.type) && e.type !== '스탯';
                });

            if (filteredTypeArr.length === 0) return;

            const typeIncludes = (kw) => filteredTypeArr.some(e => e.type.includes(kw));

            const typeStr = filteredTypeArr
                .map(e => {
                    const st = e.skillType || t.skillType;
                    const suffix = (['스킬 치명타 확률', '스킬 치명타 피해', '스킬 배율 증가'].includes(e.type) && st)
                        ? ` (${Array.isArray(st) ? st.join(', ') : st})` : '';

                    // [New] val이 0%이고 scaling이 있으면 리스트 항목에 직접 공식을 표시
                    if ((e.val === '0%' || t.val === '0%') && (e.scaling || t.scaling)) {
                        const sc = e.scaling || t.scaling;
                        const ratioDisp = (typeof sc.ratio === 'string') ? sc.ratio : `${sc.ratio}%`;
                        return `${getStatName(sc.stat)} 1포인트당 ${e.type}${suffix} +${ratioDisp}`;
                    }

                    const scalingSuffix = e.scaling ? ` (<span class="tooltip-muted">+${getStatName(e.scaling.stat)} 비례</span>)` : '';
                    return e.val !== undefined ? `${e.type}${suffix} +${e.val}${scalingSuffix}` : `${e.type}${suffix}${scalingSuffix}`;
                }).join(' / ');

            const isPotential = potLevel !== null;
            const item = {
                ...t,
                _typeStr: typeStr,
                _isUnbalanced: typeIncludes('불균형 목표에 주는 피해'),
                sourceLabel: isPotential ? `${potLevel}잠재` : sourceArr.join('/'),
                active: !isPotential || currentPot >= potLevel,
                isPotential,
                sortWeight,
            };

            const isSynergy = this.SYNERGY_TYPES.some(syn => typeIncludes(syn)) || t.target === '팀' || t.target === '적' || filteredTypeArr.some(e => e.target === '팀' || e.target === '적');
            if (isSynergy) synergyItems.push(item);
            else if (this.TRAIT_TYPES.some(tr => typeIncludes(tr))) traitItems.push(item);
        };

        /**
         * 데이터 배열을 순회하며 processSingle을 호출한다.
         * @param {Array} data - 효과 배열 (2차원)
         * @param {string|Array} source
         * @param {number} sortWeight
         * @param {number|null} potLevel
         */
        const processData = (data, source, sortWeight, potLevel = null) => {
            data?.forEach(t => t?.forEach(sub => processSingle(sub, source, sortWeight, potLevel)));
        };

        // 스킬 / 재능 / 잠재 데이터를 분류
        op.skill?.forEach(s => {
            let skillDef = { ...s };
            let level = 'M3';
            if (typeof state !== 'undefined') {
                if (state.mainOp && state.mainOp.id === op.id) {
                    const skillNameForLvl = Array.isArray(s.skillType) ? s.skillType[0] : (s.skillType || '');
                    const baseType = s.masterySource || (skillNameForLvl.startsWith('강화 ') ? skillNameForLvl.substring(3) : skillNameForLvl);
                    level = state.mainOp.skillLevels?.[baseType] || 'M3';
                } else {
                    const subMatch = state.subOps?.find(sub => sub.id === op.id);
                    if (subMatch) {
                        const skillNameForLvl = Array.isArray(s.skillType) ? s.skillType[0] : (s.skillType || '');
                        const baseType = s.masterySource || (skillNameForLvl.startsWith('강화 ') ? skillNameForLvl.substring(3) : skillNameForLvl);
                        level = subMatch.skillLevels?.[baseType] || 'M3';
                    }
                }
            }
            if (s.levels && s.levels[level]) {
                Object.assign(skillDef, s.levels[level]);
            }
            processData([[skillDef]], skillDef.skillType || '스킬', 0);
        });
        op.talents?.forEach((t, i) => processData([t], `${i + 1}재능`, 1));
        op.potential?.forEach((p, i) => processData([p], '잠재', 2, i + 1));

        /**
         * 특성/시너지 아이템 배열을 정렬하여 HTML 목록으로 변환한다.
         * @param {Array} list
         * @param {boolean} isSynergy
         * @returns {string}
         */
        const renderList = (list, isSynergy = false) =>
            [...list].sort((a, b) => a.sortWeight - b.sortWeight).map(t => {
                const valStr = !t._typeStr && t.val !== undefined ? ` +${t.val}` : '';
                const color = isSynergy ? '#FFFA00' : 'var(--accent)';
                const style = t.active === false ? 'color:var(--text-secondary);font-weight:normal;' : `color:${color};font-weight:bold;`;
                return `<div style="margin-bottom:2px;${style}"><span style="color:inherit">•</span> [${t.sourceLabel}] ${t._typeStr ?? t.type}${valStr}</div>`;
            }).join('');

        // 재능/잠재 설명 추출 및 색상화
        const extractDescs = (pool, labelPrefix) =>
            (pool || []).map((t, i) => {
                const entry = t.find(e => e.desc);
                return entry ? `[${i + 1}${labelPrefix}] ${this.colorizeText(entry.desc)}` : null;
            }).filter(Boolean);

        const descHtml = [...extractDescs(op.talents, '재능'), ...extractDescs(op.potential, '잠재')].join('<br>');

        return `
            <div class="tooltip-header">
                <div class="tooltip-icon"><img src="images/operators/${op.name}.webp?v=${APP_VERSION}" loading="eager" decoding="async"></div>
                <div class="tooltip-title-group">
                    <div class="tooltip-name">${op.name}</div>
                    <div class="tooltip-sub">${this.getElementName(op)} / ${this.getWepTypeName(op.usableWeapons[0])}</div>
                </div>
            </div>
            ${this.makeSection('기초 능력치', `
                <div class="tooltip-stat-grid">
                    <div class="tooltip-stat-item"><span class="tooltip-stat-key">공격력</span><span class="tooltip-stat-val">${op.baseAtk || 0}</span></div>
                    <div class="tooltip-stat-item"><span class="tooltip-stat-key">${getStatName(op.mainStat)}</span><span class="tooltip-stat-val">${op.stats?.[op.mainStat] ?? 0}</span></div>
                    <div class="tooltip-stat-item"><span class="tooltip-stat-key">${getStatName(op.subStat)}</span><span class="tooltip-stat-val">${op.stats?.[op.subStat] ?? 0}</span></div>
                </div>
            `)}
            ${traitItems.length > 0 ? this.makeSection('오퍼레이터 특성', `<div class="tooltip-traits">${renderList(traitItems)}</div>`) : ''}
            ${synergyItems.length > 0 ? this.makeSection('시너지', `<div class="tooltip-traits">${renderList(synergyItems, true)}</div>`, 'color:#FFFA00') : ''}
            ${!isModal && descHtml ? this.makeSection('설명', `<div class="tooltip-desc">${descHtml}</div>`) : ''}
        `;
    },

    /**
     * 무기 툴팁 HTML을 렌더링한다.
     * 특성을 자체 버프(traitItems)와 시너지(synergyItems)로 분류한다.
     * @param {object} wep - 무기 데이터
     * @returns {string}
     */
    renderWeapon(wep) {
        const traitItems = [], synergyItems = [];

        wep.traits.forEach((t, idx) => {
            const typeArr = this.normalizeTypeArr(t.type);
            const types = typeArr.map(e => e.type);
            const isStatTrait = types.includes('스탯');
            let label = isStatTrait ? getStatName(t.stat) : types[0];
            if (t.skillType?.length > 0) label += ` (${t.skillType.join(', ')})`;

            let rangeStr = (t.valByLevel?.length > 0)
                ? `${label} ${this.fmtVal(t.valByLevel[0])} ~ ${this.fmtVal(t.valByLevel[t.valByLevel.length - 1])}`
                : `${label} ${this.fmtVal(t.val || 0)}`;
            if (t.stack) rangeStr += ` (최대 ${t.stack}중첩)`;

            const isSynergy = t.target === '팀' || t.target === '적' || types.some(tt => this.SYNERGY_TYPES.some(syn => String(tt).includes(syn)));
            const isUnbalanced = types.includes('불균형 목표에 주는 피해') && !state?.enemyUnbalanced;
            const bulletColor = isUnbalanced ? 'inherit' : isSynergy ? '#FFFA00' : 'var(--accent)';
            const html = `<div style="margin-bottom:2px;${isUnbalanced ? 'color:inherit;' : ''}"><span style="color:${bulletColor}">•</span> ${rangeStr}</div>`;

            if (isSynergy) {
                synergyItems.push(html);
            } else if (idx < 2) {
                traitItems.push(html);
            }
        });

        const lastTrait = wep.traits[wep.traits.length - 1];
        const traitDesc = lastTrait?.desc ? this.colorizeText(lastTrait.desc) : '';

        return `
            <div class="tooltip-header">
                <div class="tooltip-icon"><img src="images/weapons/${wep.name}.webp?v=${APP_VERSION}" loading="eager" decoding="async"></div>
                <div class="tooltip-title-group">
                    <div class="tooltip-name">${wep.name}</div>
                    <div class="tooltip-sub">${this.getWepTypeName(wep.type)}</div>
                </div>
            </div>
            ${this.makeSection('기초 능력치', `
                <div class="tooltip-stat-grid">
                    <div class="tooltip-stat-item"><span class="tooltip-stat-key">공격력</span><span class="tooltip-stat-val">${wep.baseAtk}</span></div>
                </div>
            `)}
            ${traitItems.length > 0 ? this.makeSection('무기 특성', `<div class="tooltip-traits">${traitItems.join('')}</div>${traitDesc ? `<div class="tooltip-desc" style="margin-top:8px;">${traitDesc}</div>` : ''}`) : ''}
            ${synergyItems.length > 0 ? this.makeSection('시너지', `<div class="tooltip-traits">${synergyItems.join('')}</div>`, 'color:#FFFA00') : ''}
        `;
    },

    /**
     * 장비 툴팁 HTML을 렌더링한다.
     * 기본 스탯과 장비 특성을 표시하며, 단조(forged) 여부에 따라 강조 색상을 적용한다.
     * @param {object} gear - 장비 데이터
     * @param {boolean} forged - 단조 여부
     * @returns {string}
     */
    renderGear(gear, forged = false) {
        const setName = DATA_SETS?.find(s => s.id === gear.set)?.name || '일반';
        const valStyle = forged ? 'style="color:var(--accent);font-weight:bold;"' : '';

        const statsHtml = [
            gear.stat1 && { type: gear.stat1, val: forged && gear.val1_f !== undefined ? gear.val1_f : gear.val1 },
            gear.stat2 && { type: gear.stat2, val: forged && gear.val2_f !== undefined ? gear.val2_f : gear.val2 },
        ].filter(Boolean).map(s =>
            `<div class="tooltip-stat-item"><span class="tooltip-stat-key">${getStatName(s.type)}</span><span class="tooltip-stat-val" ${valStyle}>+${Math.floor(s.val)}</span></div>`
        ).join('');

        // 장비 특성 HTML 생성
        let traitHtml = '';
        if (gear.trait) {
            const traitLines = gear.trait.map(t => {
                const types = this.normalizeTypeArr(t.type).map(e => e.type);
                const v = forged && t.val_f !== undefined ? t.val_f : t.val;
                let valStr = '';
                if (v !== undefined) {
                    if (typeof v === 'number') valStr = (v > 0 ? ' +' : ' ') + v.toFixed(1);
                    else valStr = String(v).startsWith('+') || String(v).startsWith('-') ? ' ' + v : ' +' + v;
                }
                const isUnbalanced = types.includes('불균형 목표에 주는 피해') && !state?.enemyUnbalanced;
                const label = types.includes('스탯') ? getStatName(t.stat) : types[0];
                const accentColor = isUnbalanced ? 'inherit' : 'var(--accent)';
                const spanStyle = (!isUnbalanced && forged) ? `style="color:var(--accent);font-weight:bold;"` : '';
                return `<div style="margin-bottom:2px;${isUnbalanced ? 'color:inherit;' : ''}"><span style="color:${accentColor}">•</span> ${label}<span ${spanStyle}>${valStr}</span></div>`;
            }).join('');
            traitHtml = this.makeSection('장비 특성', `<div class="tooltip-desc">${traitLines}</div>`);
        }

        return `
            <div class="tooltip-header">
                <div class="tooltip-icon"><img src="images/gears/${gear.name}.webp?v=${APP_VERSION}" loading="eager" decoding="async"></div>
                <div class="tooltip-title-group">
                    <div class="tooltip-name">${gear.name}</div>
                    <div class="tooltip-sub">${this.GEAR_PART_MAP[gear.part] || gear.part} / ${setName}</div>
                </div>
            </div>
            ${this.makeSection('장비 스탯', `<div class="tooltip-stat-grid">${statsHtml}</div>`)}
            ${traitHtml}
        `;
    },

    /**
     * 스킬 툴팁 HTML을 렌더링한다.
     * 공격 속성, 스킬 타입, 데미지 배율, 시너지 섹션, 설명 텍스트를 포함한다.
     * @param {string} skillType - 스킬 타입 레이블 ('일반 공격', '배틀 스킬' 등)
     * @param {object} skillData - 스킬 정의 데이터
     * @param {object} opData - 오퍼레이터 데이터
     * @param {string} extraHtml - 상단에 삽입할 추가 HTML
     * @param {Array} activeEffects - 현재 활성화된 효과 목록
     * @param {object|null} st - 현재 state
     * @returns {string}
     */
    renderSkillTooltip(skillType, skillDataOriginal, opData, extraHtml = '', activeEffects = [], st = null, overrideLevel = null) {
        if (!skillDataOriginal) return '';

        let skillData = { ...skillDataOriginal };
        const baseTypeForLvl = skillDataOriginal.masterySource || (skillType.startsWith('강화 ') ? skillType.substring(3) : skillType);
        const selectedLevel = overrideLevel || st?.mainOp?.skillLevels?.[baseTypeForLvl] || 'M3';
        if (skillDataOriginal.levels && skillDataOriginal.levels[selectedLevel]) {
            const lvlData = skillDataOriginal.levels[selectedLevel];
            if (lvlData.dmg !== undefined) skillData.dmg = lvlData.dmg;
            if (lvlData.type !== undefined) skillData.type = lvlData.type;
            if (lvlData.bonus !== undefined) skillData.bonus = lvlData.bonus;
            if (lvlData.cost !== undefined) skillData.cost = lvlData.cost;
            if (lvlData.target !== undefined) skillData.target = lvlData.target;
            if (lvlData.element !== undefined) skillData.element = lvlData.element;
            if (lvlData.desc !== undefined) skillData.desc = lvlData.desc;
        }

        const attrLines = [];

        const element = this.getElementName(skillData.element ? skillData : opData);
        if (element) attrLines.push(this.makeBulletLine(`공격 속성: ${element}`, 'var(--accent)'));
        if (skillType === '궁극기' && skillData.cost !== undefined) attrLines.push(this.makeBulletLine(`궁극기 게이지: ${skillData.cost}`));

        if (skillData.type) {
            const typeStrs = this.normalizeTypeArr(skillData.type).map(t => {
                if (typeof t === 'object' && t !== null && t.type) {
                    if (t.skillType) return null;
                    const tName = Array.isArray(t.type) ? t.type[0] : t.type;
                    const scalingSuffix = t.scaling ? ` (<span class="tooltip-muted">+${getStatName(t.scaling.stat)} 비례</span>)` : '';
                    if (t.val === '0%' && t.scaling) {
                        const ratioDisp = (typeof t.scaling.ratio === 'string') ? t.scaling.ratio : `${t.scaling.ratio}%`;
                        return `${getStatName(t.scaling.stat)} 1포인트당 ${tName}${suffix} +${ratioDisp}${scalingSuffix}`;
                    }
                    return t.val ? `${tName} +${t.val}${scalingSuffix}` : `${tName}${scalingSuffix}`;
                }
                return typeof t === 'string' ? t : '';
            }).filter(Boolean);
            if (typeStrs.length > 0) attrLines.push(this.makeBulletLine(typeStrs.join(' / ')));
        }

        if (skillData.dmg && parseInt(skillData.dmg, 10) > 0) {
            let dmgStr = `기본 데미지: <strong class="tooltip-highlight">${skillData.dmg}</strong>`;
            if (skillData.bonus) {
                dmgStr += (skillData.bonus || []).map(b => {
                    const triggers = [
                        ...(Array.isArray(b.trigger) ? b.trigger : (b.trigger ? [b.trigger] : [])),
                        ...(Array.isArray(b.triggerTarget) ? b.triggerTarget : (b.triggerTarget ? [b.triggerTarget] : []))
                    ];
                    const triggerLines = triggers.join(', ');
                    const bValStr =
                        b.val !== undefined && b.val !== '0%' ? '+' + b.val :
                            b.perStack !== undefined && b.perStack !== '0%'
                                ? (b.base && b.base !== '0%' ? `${b.base} + ${b.perStack}/스택` : `${b.perStack}/스택`)
                                : (b.base && b.base !== '0%' ? b.base : '');
                    return bValStr ? ` <span class="tooltip-muted">+ ${triggerLines} <strong class="tooltip-highlight">${bValStr}</strong></span>` : '';
                }).filter(Boolean).join('');
            }
            attrLines.push(this.makeBulletLine(dmgStr));
        }

        const synergyHtml = this.renderSynergySection(activeEffects, st, opData, skillType);
        if (synergyHtml) attrLines.push(synergyHtml);

        return `
            <div class="tooltip-title">${skillType}</div>
            ${extraHtml ? `<div class="tooltip-group">${extraHtml}</div>` : ''}
            ${attrLines.length > 0 ? `<div class="tooltip-section tooltip-group">${attrLines.join('')}</div>` : ''}
            <div class="tooltip-desc">${this.colorizeText(skillData.desc || '설명 없음')}</div>
        `;
    },

    /**
     * 시퀀스 아이템 전용 간소화된 툴팁을 렌더링한다.
     * 피해량, 데미지 배율, 적용 중인 추가 효과를 표시한다.
     * @param {string} type - 스킬 타입
     * @param {number} displayDmg - 표시할 데미지 수치
     * @param {string} rateHtml - 배율 HTML 문자열
     * @param {Array} activeEffects
     * @param {object} st - 현재 state
     * @param {object} opData - 오퍼레이터 데이터
     * @returns {string}
     */
    renderSequenceTooltip(type, displayDmg, rateHtml, activeEffects, st, opData) {
        const synergyHtml = this.renderSynergySection(activeEffects, st, opData, type);
        return `
            <div class="tooltip-title tooltip-highlight">${type}</div>
            <div class="tooltip-group">
                <div class="tooltip-desc">피해량: <strong class="tooltip-highlight">${Math.floor(displayDmg).toLocaleString()}</strong><br>데미지 배율: <strong>${rateHtml}</strong></div>
            </div>
            ${synergyHtml ? `<div class="tooltip-section tooltip-group">${synergyHtml}</div>` : ''}
        `;
    },

    /**
     * 스킬 툴팁 내부의 "적용 중인 추가 효과" 섹션을 렌더링한다.
     * 현재 스킬 타입과 관련된 activeEffects를 필터링하고,
     * 디버프 상태(방어 불능, 연타 등)를 추가로 표시한다.
     * @param {Array} activeEffects - 현재 활성 효과 배열
     * @param {object|null} st - 현재 state
     * @param {object} opData - 오퍼레이터 데이터
     * @param {string} skillType - 스킬 타입 ('일반 공격', '배틀 스킬' 등)
     * @returns {string}
     */
    renderSynergySection(activeEffects, st, opData, skillType) {
        const catKey = this.SKILL_TYPE_MAP[skillType]
            || (skillType.includes('일반 공격') ? 'normal' : skillType.includes('배틀 스킬') ? 'battle' : 'common');

        // 현재 스킬 타입에 맞는 활성화된 효과 필터링
        const filteredEffects = activeEffects.filter(eff => {
            const stTypes = eff.skillType || [];
            const t = Array.isArray(eff.type) ? eff.type[0] : eff.type;
            const baseSkillType = skillType.startsWith('강화 ') ? skillType.substring(3) : skillType;

            if (st?.disabledEffects) {
                if (st.disabledEffects.includes(`${eff.uid}#${catKey}`) || st.disabledEffects.includes(`${eff.uid}#common`)) return false;
            }

            if (eff._isExternal && (stTypes.includes(skillType) || stTypes.includes(baseSkillType))) {
                return t.endsWith('피해') || t.includes('피해') || t.includes('공격력') || t.includes('배율') || t.includes('치명타');
            }

            const isNormal = skillType === '일반 공격' || skillType.includes('강화 일반 공격');
            const isBattle = skillType === '배틀 스킬' || skillType.includes('강화 배틀 스킬');
            const isCombo = skillType === '연계 스킬';
            const isUlt = skillType === '궁극기';

            if (isNormal && t === '일반 공격 피해') return true;
            if (isBattle && t === '배틀 스킬 피해') return true;
            if (isCombo && t === '연계 스킬 피해') return true;
            if (isUlt && t === '궁극기 피해') return true;
            if ((isBattle || isCombo || isUlt) && (t === '모든 스킬 피해' || t === '스킬 배율 증가')) {
                return stTypes.length === 0 || stTypes.includes(skillType) || stTypes.includes(baseSkillType);
            }
            return false;
        }).sort((a, b) => {
            const ta = Array.isArray(a.type) ? a.type[0] : a.type;
            const tb = Array.isArray(b.type) ? b.type[0] : b.type;
            if (ta === '모든 스킬 피해' && tb !== '모든 스킬 피해') return -1;
            if (ta !== '모든 스킬 피해' && tb === '모든 스킬 피해') return 1;
            if (ta === '스킬 배율 증가' && tb !== '스킬 배율 증가') return 1;
            if (ta !== '스킬 배율 증가' && tb === '스킬 배율 증가') return -1;
            return 0;
        });

        // 디버프 상태 및 스페셜 스택 정보 수집
        const extraEffects = [];
        if (st?.debuffState) {
            const { physDebuff, artsAttach, artsAbnormal } = st.debuffState;
            if (physDebuff?.defenseless > 0) extraEffects.push(`방어 불능 ${physDebuff.defenseless}스택`);
            if (physDebuff?.armorBreak > 0) extraEffects.push(`갑옷 파괴 ${physDebuff.armorBreak}스택`);
            if (physDebuff?.combo > 0) {
                const isBattleOrUlt = skillType === '배틀 스킬' || skillType.includes('강화 배틀 스킬');
                const multTable = isBattleOrUlt ? [0, 1.3, 1.45, 1.6, 1.75] : (skillType === '궁극기' ? [0, 1.2, 1.3, 1.4, 1.5] : null);
                extraEffects.push(multTable ? `연타 *${multTable[Math.min(physDebuff.combo, 4)].toFixed(2)}배` : `연타 ${physDebuff.combo}스택`);
            }
            if (artsAttach?.type && artsAttach.stacks > 0) extraEffects.push(`${artsAttach.type} ${artsAttach.stacks}스택`);
            Object.entries(artsAbnormal || {}).forEach(([n, s]) => { if (s > 0) extraEffects.push(`${n} ${s}스택`); });
        }
        if (st?.mainOp?.specialStack && opData?.specialStack) {
            (Array.isArray(opData.specialStack) ? opData.specialStack : [opData.specialStack]).forEach(s => {
                const c = st.mainOp.specialStack[s.id || 'default'] || 0;
                if (c > 0) extraEffects.push(`${s.name} ${c}스택`);
            });
        }

        // 스킬 bonus 트리거 발동 여부 확인 후 표시
        const opDataLocal = opData || DATA_OPERATORS?.find(o => o.id === st?.mainOp?.id);
        if (st && skillType && opDataLocal) {
            const rawSkill = opDataLocal.skill?.find(s => s.skillType?.includes(skillType));
            if (rawSkill) {
                let skillDef = { ...rawSkill };
                const skillNameForLvl = Array.isArray(rawSkill.skillType) ? rawSkill.skillType[0] : (rawSkill.skillType || '');
                const baseType = rawSkill.masterySource || (skillNameForLvl.startsWith('강화 ') ? skillNameForLvl.substring(3) : skillNameForLvl);
                const level = st?.mainOp?.skillLevels?.[baseType] || 'M3';
                if (rawSkill.levels && rawSkill.levels[level]) {
                    Object.assign(skillDef, rawSkill.levels[level]);
                }

                (Array.isArray(skillDef.bonus) ? skillDef.bonus : []).forEach(b => {
                    const opTrMet = !b.trigger || evaluateTrigger(b.trigger, st, opDataLocal, null, false, null, true);
                    const tgTrMet = !b.triggerTarget || evaluateTrigger(b.triggerTarget, st, opDataLocal, null, true, null, true);
                    if ((b.trigger || b.triggerTarget) && opTrMet && tgTrMet) {
                        const triggers = [
                            ...(Array.isArray(b.trigger) ? b.trigger : (b.trigger ? [b.trigger] : [])),
                            ...(Array.isArray(b.triggerTarget) ? b.triggerTarget : (b.triggerTarget ? [b.triggerTarget] : []))
                        ];
                        const triggerTxt = triggers.join(', ');
                        if (!extraEffects.some(ee => ee.includes(triggerTxt))) {
                            extraEffects.push(`${triggerTxt}`);
                        }
                    }
                });
            }
        }

        if (filteredEffects.length === 0 && extraEffects.length === 0) return '';

        let html = '<div style="margin-top:8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top:8px;"></div>';
        html += '<div class="tooltip-label" color:var(--accent); margin-bottom:4px;">적용 중인 추가 효과</div>';

        filteredEffects.forEach(eff => {
            const t = Array.isArray(eff.type) ? eff.type[0] : eff.type;
            let valStr = '';
            if (t === '스킬 배율 증가') {
                valStr = eff.dmg !== undefined ? ` +${eff.dmg}` : ` *${(1 + (parseFloat(eff.val) || 0) / 100).toFixed(2)}`;
            } else if (eff.val !== undefined) {
                valStr = ` +${eff.val}`;
            }
            html += this.makeBulletLine(`${t}${valStr}`, 'var(--accent)', 'color:var(--accent);');
        });

        extraEffects.forEach(txt => {
            html += this.makeBulletLine(txt, '#FFFA00', 'color:#FFFA00;');
        });

        return html;
    },

    /**
     * 물리 이상 또는 아츠 이상/폭발 툴팁을 렌더링한다.
     * DATA_ABNORMALS에서 데이터를 조회하고, 오리지늄 아츠 강도 및 적용 중인 디버프를 표시한다.
     * @param {string} aName - 이상 상태 이름 (예: '연소(이상)', '강타')
     * @param {number} artsStrength - 오리지늄 아츠 강도 수치 (%)
     * @param {object|null} st - 현재 state (디버프 표시용)
     * @returns {string}
     */
    renderAbnormalTooltip(aName, artsStrength = 0, st = null, overrideElements = null) {
        /**
         * 이상 상태 이름으로 DATA_ABNORMALS에서 데이터를 찾는다.
         * '(이상)' 접미사를 제거한 이름으로 재시도한다.
         */
        const getAbnormalData = (name) => {
            if (typeof DATA_ABNORMALS === 'undefined') return null;
            return DATA_ABNORMALS[name] || DATA_ABNORMALS[name.replace('(이상)', '')] || null;
        };

        const data = getAbnormalData(aName);
        const attrLines = [];
        const synergyLines = [];

        if (data) {
            const elementMap = { phys: '물리', heat: '열기', elec: '전기', cryo: '냉기', nature: '자연', arts: '아츠(속성 일치)' };

            // 아츠 폭발 등 동적 속성 대응
            if (aName === '아츠 폭발' && overrideElements && overrideElements.length > 0) {
                const elNames = overrideElements.map(el => elementMap[el] || el).join(', ');
                attrLines.push(this.makeBulletLine(`공격 속성: ${elNames}`, 'var(--accent)'));
            } else {
                const elName = elementMap[data.element];
                if (elName) attrLines.push(this.makeBulletLine(`공격 속성: ${elName}`, 'var(--accent)'));
            }

            if (data.base) {
                const multiplier = 1 + (artsStrength / 100);
                const scalePct = (str) => (parseFloat(str.replace('%', '')) * multiplier).toFixed(0) + '%';
                let dmgStr = `기본 데미지: <strong class="tooltip-highlight">${scalePct(data.base)}</strong>`;
                if (data.perStack) {
                    dmgStr += ` <span class="tooltip-muted">+ ${data.trigger || '스택'} * <strong class="tooltip-highlight">${scalePct(data.perStack)}</strong></span>`;
                }
                attrLines.push(this.makeBulletLine(dmgStr));
            }

            // 디버프 상태 기반 시너지 정보 수집
            if (st?.debuffState) {
                const { physDebuff, artsAbnormal } = st.debuffState;
                const isPhys = data.element === 'phys';
                const isArts = ['heat', 'elec', 'cryo', 'nature'].includes(data.element);

                if (physDebuff?.defenseless > 0) synergyLines.push(`방어 불능 ${physDebuff.defenseless}스택`);
                if (isPhys && physDebuff?.armorBreak > 0) synergyLines.push(`갑옷 파괴 ${physDebuff.armorBreak}단계`);
                if (isArts && artsAbnormal?.['감전'] > 0) synergyLines.push(`감전 ${artsAbnormal['감전']}단계 (받는 아츠 피해 증가)`);
                if (artsAbnormal?.['부식'] > 0) synergyLines.push(`부식 ${artsAbnormal['부식']}단계 (모든 저항 감소)`);
            }
        }

        let html = `<div class="tooltip-title">${aName.replace('(이상)', '')}</div>`;
        if (attrLines.length > 0) html += `<div class="tooltip-section tooltip-group">${attrLines.join('')}</div>`;

        if (synergyLines.length > 0 || artsStrength > 0) {
            html += '<div style="margin-top:8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top:8px;"></div>';
            html += '<div class="tooltip-label" color:var(--accent); margin-bottom:4px;">적용 중인 추가 효과</div>';
            if (artsStrength > 0) {
                html += this.makeBulletLine(`오리지늄 아츠 강도 +${artsStrength.toFixed(1)}%`, 'var(--accent)', 'color:var(--accent);');
            }
            synergyLines.forEach(txt => {
                html += this.makeBulletLine(txt, '#FFFA00', 'color:#FFFA00;');
            });
        }

        html += `<div class="tooltip-desc">${this.colorizeText(data?.desc ?? '설명 없음')}</div>`;
        return html;
    },
};