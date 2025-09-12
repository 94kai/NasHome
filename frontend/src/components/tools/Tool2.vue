<template>
    <div>
        <h3>工具 2</h3>
        <p>这是一个文本反转示例。</p>
        <input v-model="text" placeholder="输入文本...">
        <p>反转后: {{ reversedText }}</p>
    </div>
</template>

<script>
export default {
    data() {
        return {
            text: ''
        };
    },
    computed: {
        reversedText() {
            return this.text.split('').reverse().join('');
        }
    }
};
</script>
